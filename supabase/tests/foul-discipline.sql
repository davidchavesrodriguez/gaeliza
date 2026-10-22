\ir fixtures/editing.sql
insert into public.analysis_participants(id,analysis_id,team_id,display_name_snapshot)
 values(pg_temp.id(62),pg_temp.id(40),pg_temp.id(10),'Other home');
create function pg_temp.foul(card text default null, recipient uuid default null) returns jsonb language sql as $$
 select public.log_foul_with_optional_card(pg_temp.id(40),pg_temp.id(50),pg_temp.id(10),74,
  p_x=>0,p_y=>45,p_detail=>'{"cause":"push","outcome":"free"}',
  p_participants=>jsonb_build_array(jsonb_build_object('participant_id',pg_temp.id(60),'role','offender')),
  p_card_type=>card,p_card_recipient_id=>recipient)
$$;
select updated_at as before_activity from public.analyses where id=pg_temp.id(40) \gset
select pg_temp.foul() as plain \gset
select pg_temp.check_true((:'plain'::jsonb->>'card_event_id') is null and (select count(*)=1 from public.events),'plain foul creates only one event');
select pg_temp.check_true((select status='in_progress' and updated_at>:'before_activity'::timestamptz from public.analyses where id=pg_temp.id(40)),'capture advances activity and draft status');
do $$ declare kind text; result jsonb; f uuid; c uuid; begin
 foreach kind in array array['yellow','black','red'] loop
 result:=pg_temp.foul(kind,pg_temp.id(62)); f:=(result->>'foul_event_id')::uuid; c:=(result->>'card_event_id')::uuid;
 perform pg_temp.check_true((select card_type=kind and related_foul_event_id=f from public.card_events where event_id=c),kind||' canonical relation');
 perform pg_temp.check_true((select count(*)=2 from public.events where id in(f,c)),kind||' two canonical facts');
 perform pg_temp.check_true((select analysis_id=pg_temp.id(40) and period_id=pg_temp.id(50) and team_id=pg_temp.id(10) and second_in_period=74 and x is null and y is null from public.events where id=c),kind||' card identity/time and no coordinates');
 perform pg_temp.check_true((select x=0 and y=45 and second_in_period=74 from public.events where id=f),kind||' foul preserves physical origin');
 perform pg_temp.check_true((select analysis_participant_id=pg_temp.id(62) and role='card_recipient' from public.event_participants where event_id=c),kind||' recipient differs from offender');
 end loop;
end $$;
select pg_temp.foul('yellow') as unknown \gset
select pg_temp.check_true(not exists(select 1 from public.event_participants where event_id=(:'unknown'::jsonb->>'card_event_id')::uuid),'recipient optional');
select public.update_event(pg_temp.id(40),(:'unknown'::jsonb->>'card_event_id')::uuid,pg_temp.id(10),pg_temp.id(50),74,
 (select updated_at from public.events where id=(:'unknown'::jsonb->>'card_event_id')::uuid),null,null,'{"card_type":"red"}','[]');
select pg_temp.check_true((select card_type='red' and related_foul_event_id=(:'unknown'::jsonb->>'foul_event_id')::uuid
 from public.card_events where event_id=(:'unknown'::jsonb->>'card_event_id')::uuid),'individual card edit preserves relation');
select pg_temp.capture('card','{"card_type":"yellow"}') as standalone \gset
select pg_temp.check_true((select related_foul_event_id is null from public.card_events where event_id=:'standalone'),'standalone card unchanged');
select count(*) as before_count from public.events \gset
select updated_at as before_failure from public.analyses where id=pg_temp.id(40) \gset
select pg_temp.rejects($q$select pg_temp.foul('')$q$,'23514','empty card type rejected');
select pg_temp.rejects($q$select pg_temp.foul('purple')$q$,'23514','invalid second event rejected');
select pg_temp.rejects($q$select pg_temp.foul('red',pg_temp.id(61))$q$,'23514','opposing recipient rejected');
select pg_temp.check_true((select count(*)=:'before_count' from public.events),'second event failures leave no orphan foul');
select pg_temp.check_true((select updated_at=:'before_failure'::timestamptz from public.analyses where id=pg_temp.id(40)),'failed composite rolls back aggregate activity');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.rejects($q$select pg_temp.foul('yellow')$q$,'42501','unauthenticated rejected');
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);
select pg_temp.rejects($q$select pg_temp.foul('yellow')$q$,'42501','other owner rejected');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
update public.analyses set status='completed' where id=pg_temp.id(40);
select pg_temp.rejects($q$select pg_temp.foul('yellow')$q$,'23514','completed rejected');
update public.analyses set status='in_progress' where id=pg_temp.id(40);
delete from public.events where id=(:'unknown'::jsonb->>'foul_event_id')::uuid;
select pg_temp.check_true((select related_foul_event_id is null from public.card_events where event_id=(:'unknown'::jsonb->>'card_event_id')::uuid),'delete foul leaves independent card');
-- A second owned analysis is still not a valid target for a related card.
insert into public.analyses(id,match_id,owner_user_id) values(pg_temp.id(41),pg_temp.id(30),pg_temp.id(1));
insert into public.analysis_periods(id,analysis_id,number) values(pg_temp.id(51),pg_temp.id(41),1);
select public.log_event(pg_temp.id(41),pg_temp.id(51),pg_temp.id(10),'foul',0) as foreign_foul \gset
select pg_temp.rejects(format($q$update public.card_events set related_foul_event_id=%L where event_id=%L$q$,:'foreign_foul',:'standalone'),'23514','cross-analysis relation rejected');
select pg_temp.rejects(format($q$update public.card_events set related_foul_event_id=%L where event_id=%L$q$,:'standalone',:'standalone'),'23514','relation must target foul');
select pg_temp.check_true(not has_function_privilege('anon','public.log_foul_with_optional_card(uuid,uuid,uuid,integer,numeric,numeric,jsonb,jsonb,text,uuid)','EXECUTE'),'anonymous execute revoked');
rollback;
