-- Disposable local DB only; assertions run as the authenticated owner under RLS.
\ir fixtures/editing.sql

-- Observe actual parent writes, not just clock differences. This also proves
-- that no-op children and analysis-delete cascades do not UPDATE a parent.
set local role postgres;
create temporary table activity_writes(analysis_id uuid);
grant select, insert on activity_writes to authenticated;
create function pg_temp.record_activity_write() returns trigger language plpgsql as $$
begin insert into pg_temp.activity_writes values(new.id); return new; end$$;
create trigger test_activity_write after update on public.analyses
for each row execute function pg_temp.record_activity_write();
set local role authenticated;

create function pg_temp.activity_change(command text, label text, advances boolean default true)
returns void language plpgsql as $$
declare before_version timestamptz; after_version timestamptz; before_writes bigint;
begin
 select updated_at into strict before_version from public.analyses where id=pg_temp.id(40);
 select count(*) into before_writes from pg_temp.activity_writes;
 execute command;
 select updated_at into strict after_version from public.analyses where id=pg_temp.id(40);
 perform pg_temp.check_true(case when advances then after_version>before_version else after_version=before_version end,label);
 if not advances then
  perform pg_temp.check_true((select count(*)=before_writes from pg_temp.activity_writes),label || ': no parent write');
 end if;
end$$;

-- Old timestamps on inserted children ensure a no-op still changes their own
-- bookkeeping updated_at via now(); that must not manufacture parent activity.
select pg_temp.activity_change($q$insert into public.analysis_participants(id,analysis_id,team_id,display_name_snapshot,updated_at)
 values(pg_temp.id(62),pg_temp.id(40),pg_temp.id(10),'Extra player','2000-01-01')$q$,'participant INSERT advances activity');
select pg_temp.activity_change($q$update public.analysis_participants set display_name_snapshot=display_name_snapshot where id=pg_temp.id(62)$q$,'participant no-op',false);
select pg_temp.activity_change($q$update public.analysis_participants set number=8 where id=pg_temp.id(62)$q$,'participant UPDATE advances activity');
select pg_temp.activity_change($q$delete from public.analysis_participants where id=pg_temp.id(62)$q$,'participant DELETE advances activity');

select pg_temp.activity_change($q$insert into public.analysis_videos(id,analysis_id,url,duration_seconds,updated_at)
 values(pg_temp.id(70),pg_temp.id(40),'https://example.test/match.webm',60,'2000-01-01')$q$,'video INSERT advances activity');
select pg_temp.activity_change($q$update public.analysis_videos set url=url where id=pg_temp.id(70)$q$,'video no-op',false);
select pg_temp.activity_change($q$update public.analysis_videos set title='Main camera' where id=pg_temp.id(70)$q$,'video UPDATE advances activity');

select pg_temp.activity_change($q$insert into public.video_sync_points(id,analysis_id,analysis_video_id,analysis_period_id,video_second,second_in_period,updated_at)
 values(pg_temp.id(71),pg_temp.id(40),pg_temp.id(70),pg_temp.id(50),0,0,'2000-01-01')$q$,'sync INSERT advances activity');
select pg_temp.activity_change($q$update public.video_sync_points set video_second=video_second where id=pg_temp.id(71)$q$,'sync no-op',false);
select pg_temp.activity_change($q$update public.video_sync_points set video_second=1 where id=pg_temp.id(71)$q$,'sync UPDATE advances activity');
select pg_temp.activity_change($q$delete from public.video_sync_points where id=pg_temp.id(71)$q$,'sync DELETE advances activity');

select pg_temp.activity_change($q$insert into public.analysis_periods(id,analysis_id,number,sort_order,updated_at)
 values(pg_temp.id(51),pg_temp.id(40),2,1,'2000-01-01')$q$,'period INSERT advances activity');
select pg_temp.activity_change($q$update public.analysis_periods set name=name where id=pg_temp.id(51)$q$,'period no-op',false);
select pg_temp.activity_change($q$update public.analysis_periods set home_attacks_towards='right' where id=pg_temp.id(51)$q$,'period direction UPDATE advances activity');
select pg_temp.activity_change($q$delete from public.analysis_periods where id=pg_temp.id(51)$q$,'period DELETE advances activity');

-- A video deletion also removes its syncs while the analysis survives.
insert into public.video_sync_points(analysis_id,analysis_video_id,analysis_period_id,video_second,second_in_period)
 values(pg_temp.id(40),pg_temp.id(70),pg_temp.id(50),0,0);
select pg_temp.activity_change($q$delete from public.analysis_videos where id=pg_temp.id(70)$q$,'video DELETE with sync cascade advances activity');
select pg_temp.check_true(not exists(select 1 from public.video_sync_points),'video cascade removes sync points');

-- The first bare event performs one parent write, including the old automatic
-- draft transition; details/roles subsequently count as their own real changes.
select count(*) as before_first_event_writes from pg_temp.activity_writes \gset
select pg_temp.activity_change($q$insert into public.events(id,analysis_id,team_id,period_id,event_type,second_in_period,created_by)
 values(pg_temp.id(79),pg_temp.id(40),pg_temp.id(10),pg_temp.id(50),'block',0,(select auth.uid()))$q$,'bare event INSERT advances activity');
select pg_temp.check_true((select count(*)=:'before_first_event_writes'::bigint+1 from pg_temp.activity_writes) and
 (select status='in_progress' from public.analyses where id=pg_temp.id(40)),'first event folds draft transition into one parent UPDATE');

select updated_at as before_event from public.analyses where id=pg_temp.id(40) \gset
select pg_temp.capture('shot','{"result":"point"}',
 '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"shooter"}]') as shot \gset
select pg_temp.check_true((select updated_at>:'before_event'::timestamptz and status='in_progress' from public.analyses where id=pg_temp.id(40)),
 'log_event INSERT advances activity and transitions draft to in_progress');

select pg_temp.activity_change(format($q$update public.shot_events set technique='foot' where event_id=%L$q$,:'shot'),'detail-only UPDATE propagates through event');
select pg_temp.activity_change(format($q$update public.shot_events set technique=technique where event_id=%L$q$,:'shot'),'detail no-op',false);
select pg_temp.activity_change(format($q$delete from public.shot_events where event_id=%L$q$,:'shot'),'detail-only DELETE propagates through event');
select pg_temp.activity_change(format($q$insert into public.shot_events(event_id,result) values(%L,'point')$q$,:'shot'),'detail-only INSERT propagates through event');
select pg_temp.activity_change(format($q$delete from public.event_participants where event_id=%L$q$,:'shot'),'event participant-only DELETE propagates through event');
select pg_temp.activity_change(format($q$insert into public.event_participants(event_id,analysis_id,analysis_participant_id,role)
 values(%L,pg_temp.id(40),pg_temp.id(60),'shooter')$q$,:'shot'),'event participant-only INSERT propagates through event');
-- Authenticated UPDATE still has no RLS policy; privileged maintenance covers
-- the allowed UPDATE path without granting any additional permissions.
set local role postgres;
select pg_temp.activity_change(format($q$update public.event_participants set role='assister' where event_id=%L$q$,:'shot'),'permitted event participant-only UPDATE propagates');
select pg_temp.activity_change(format($q$update public.event_participants set role=role where event_id=%L$q$,:'shot'),'event participant no-op',false);
set local role authenticated;
select pg_temp.activity_change(format($q$update public.events set x=x where id=%L$q$,:'shot'),'event no-op',false);
select pg_temp.activity_change(format($q$update public.events set notes='Reviewed' where id=%L$q$,:'shot'),'direct event UPDATE advances activity');

select updated_at as edit_version from public.events where id=:'shot' \gset
select pg_temp.activity_change(format($q$select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),20,%L,0,0,'{"result":"goal"}',
 '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"shooter"}]')$q$,:'shot',:'edit_version'),'update_event advances activity');
select pg_temp.check_true((select result='goal' from public.shot_events where event_id=:'shot'),'update_event still persists typed details');

-- Fail late, after base/detail/role writes have already touched both aggregates.
select updated_at as before_rollback from public.analyses where id=pg_temp.id(40) \gset
select updated_at as before_rollback_event from public.events where id=:'shot' \gset
select count(*) as before_rollback_writes from pg_temp.activity_writes \gset
select pg_temp.rejects(format($q$select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),99,%L,1,1,'{"result":"wide"}',
 '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"offender"}]')$q$,:'shot',:'before_rollback_event'),'23514','late RPC failure rolls back activity');
select pg_temp.check_true((select updated_at=:'before_rollback'::timestamptz from public.analyses where id=pg_temp.id(40)) and
 (select updated_at=:'before_rollback_event'::timestamptz and second_in_period=20 from public.events where id=:'shot') and
 (select result='goal' from public.shot_events where event_id=:'shot') and
 (select count(*)=:'before_rollback_writes'::bigint from pg_temp.activity_writes),'rollback restores timestamps, payload and parent writes');

-- Reassignment updates both owned aggregates, not just the new parent.
select public.create_analysis(pg_temp.id(30),'Another workspace') as other_analysis \gset
select pg_temp.check_true((select status='draft' and updated_at>created_at from public.analyses where id=:'other_analysis') and
 (select count(*)=2 from public.analysis_periods where analysis_id=:'other_analysis'),'create_analysis keeps its two periods and draft status under activity triggers');
insert into public.analysis_participants(id,analysis_id,team_id,display_name_snapshot)
 values(pg_temp.id(63),pg_temp.id(40),pg_temp.id(10),'Movable player');
select updated_at as old_parent from public.analyses where id=pg_temp.id(40) \gset
select updated_at as new_parent from public.analyses where id=:'other_analysis' \gset
update public.analysis_participants set analysis_id=:'other_analysis' where id=pg_temp.id(63);
select pg_temp.check_true((select updated_at>:'old_parent'::timestamptz from public.analyses where id=pg_temp.id(40)) and
 (select updated_at>:'new_parent'::timestamptz from public.analyses where id=:'other_analysis'),'reassignment advances both analyses');

-- Strict clock progression does not depend on now() changing between statements.
select updated_at as metadata_version from public.analyses where id=pg_temp.id(40) \gset
update public.analyses set title=title where id=pg_temp.id(40);
select pg_temp.check_true((select updated_at=:'metadata_version'::timestamptz from public.analyses where id=pg_temp.id(40)),'analysis metadata no-op preserves its timestamp');
update public.analyses set title='Changed title' where id=pg_temp.id(40);
select pg_temp.check_true((select updated_at>:'metadata_version'::timestamptz from public.analyses where id=pg_temp.id(40)),'analysis metadata changes use the same monotonic clock');

update public.analyses set visibility='public' where id=pg_temp.id(40);
select updated_at as permission_version from public.analyses where id=pg_temp.id(40) \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
update public.events set notes='not permitted' where id=:'shot';
update public.analysis_participants set number=99 where id=pg_temp.id(60);
select pg_temp.check_true((select updated_at=:'permission_version'::timestamptz from public.analyses where id=pg_temp.id(40)),
 'public read access does not permit mutations or activity changes');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);

-- Existing completed event boundaries remain effective, including child writes.
update public.analyses set status='completed' where id=pg_temp.id(40);
select updated_at as completed_version from public.analyses where id=pg_temp.id(40) \gset
select pg_temp.rejects($q$select pg_temp.capture('pass')$q$,'23514','completed rejects log_event');
select pg_temp.rejects(format($q$update public.events set notes='blocked' where id=%L$q$,:'shot'),'23514','completed rejects event UPDATE');
select pg_temp.rejects(format($q$delete from public.events where id=%L$q$,:'shot'),'23514','completed rejects event DELETE');
select pg_temp.rejects(format($q$update public.shot_events set technique='hand' where event_id=%L$q$,:'shot'),'23514','completed rejects detail mutation');
select pg_temp.rejects(format($q$delete from public.event_participants where event_id=%L$q$,:'shot'),'23514','completed rejects role mutation');
select pg_temp.rejects(format($q$select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),20,%L)$q$,:'shot',:'before_rollback_event'),'23514','completed rejects update_event');
select pg_temp.check_true((select updated_at=:'completed_version'::timestamptz and status='completed' from public.analyses where id=pg_temp.id(40)),'rejected completed mutations preserve activity and status');
update public.analyses set status='in_progress' where id=pg_temp.id(40);
select pg_temp.activity_change(format($q$delete from public.events where id=%L$q$,:'shot'),'event DELETE advances activity');
select pg_temp.check_true(not exists(select 1 from public.shot_events where event_id=:'shot') and
 not exists(select 1 from public.event_participants where event_id=:'shot'),'event DELETE still cascades through details and roles');

-- Leave every child category populated, then delete a COMPLETED analysis. Its
-- children must not attempt to update the disappearing parent or reopen it.
insert into public.analysis_videos(id,analysis_id,url) values(pg_temp.id(70),pg_temp.id(40),'https://example.test/again.webm');
insert into public.video_sync_points(analysis_id,analysis_video_id,analysis_period_id,video_second,second_in_period)
 values(pg_temp.id(40),pg_temp.id(70),pg_temp.id(50),0,0);
select pg_temp.capture('shot','{"result":"point"}',
 '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"shooter"}]');
update public.analyses set status='completed' where id=pg_temp.id(40);
select count(*) as before_cascade_writes from pg_temp.activity_writes \gset
delete from public.analyses where id=pg_temp.id(40);
set constraints all immediate;
select pg_temp.check_true(not exists(select 1 from public.analyses where id=pg_temp.id(40)) and
 not exists(select 1 from public.analysis_periods where analysis_id=pg_temp.id(40)) and
 not exists(select 1 from public.analysis_participants where analysis_id=pg_temp.id(40)) and
 not exists(select 1 from public.analysis_videos where analysis_id=pg_temp.id(40)) and
 not exists(select 1 from public.video_sync_points where analysis_id=pg_temp.id(40)) and
 not exists(select 1 from public.events where analysis_id=pg_temp.id(40)),'completed analysis DELETE cascades across all workspace children');
select pg_temp.check_true((select count(*)=:'before_cascade_writes'::bigint from pg_temp.activity_writes),'analysis cascade performs zero parent UPDATEs');
select pg_temp.check_true((select status='draft' from public.analyses where id=:'other_analysis'),'cascade does not touch the surviving analysis');
select pg_temp.check_true(not (select prosecdef from pg_proc where oid='private.propagate_analysis_activity()'::regprocedure) and
 not (select prosecdef from pg_proc where oid='private.set_aggregate_updated_at()'::regprocedure),'new activity functions are security invoker');
select pg_temp.check_true(not has_function_privilege('authenticated','private.propagate_analysis_activity()','EXECUTE'),'activity trigger helper is not directly callable');
rollback;
