\ir fixtures/editing.sql
-- Direct team insert uses the existing owner RLS, also for authenticated guests.
insert into public.teams(id,name,gender,scope,owner_user_id)
 values(pg_temp.id(11),'Personal home','mixed','personal',auth.uid()),
       (pg_temp.id(12),'Quick rival','female','personal',auth.uid());
select pg_temp.check_true((select club_id is null and default_venue_id is null and active and owner_user_id=auth.uid() from public.teams where id=pg_temp.id(11)),'personal team defaults and ownership');
select pg_temp.rejects($q$insert into public.teams(name,gender,scope,owner_user_id) values('Spoof','mixed','personal',pg_temp.id(2))$q$,'42501','cannot spoof team owner');
select public.create_team_player(pg_temp.id(11),'  Ana  ',' García ',8,'Goalkeeper') as player_id \gset
select pg_temp.check_true((select owner_user_id=auth.uid() and first_name='Ana' and last_name='García' and primary_position='Goalkeeper' and active from public.players where id=:'player_id'),'player owner/name/position');
select pg_temp.check_true((select default_number=8 and active from public.team_players where team_id=pg_temp.id(11) and player_id=:'player_id'),'membership and number');
select public.create_team_player(pg_temp.id(11),'Brais') as optional_player \gset
select pg_temp.check_true((select last_name is null and primary_position is null from public.players where id=:'optional_player'),'optional player fields');
select pg_temp.check_true((select default_number is null from public.team_players where player_id=:'optional_player'),'optional shirt number');
select count(*) as before_players from public.players \gset
select pg_temp.rejects($q$select public.create_team_player(pg_temp.id(11),'Rollback',p_default_number=>0)$q$,'23514','membership failure after player INSERT');
select pg_temp.check_true((select count(*)=:'before_players' from public.players),'no orphan player after rollback');
select pg_temp.rejects($q$select public.create_team_player(pg_temp.id(10),'Official')$q$,'42501','official team not editable through RPC');
select pg_temp.rejects($q$select public.create_team_player(pg_temp.id(999),'Hidden')$q$,'42501','unknown team rejected');
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);
insert into public.teams(id,name,gender,scope,owner_user_id) values(pg_temp.id(13),'Other private','mixed','personal',auth.uid());
select public.create_team_player(pg_temp.id(13),'Other player') as other_player \gset
select pg_temp.rejects($q$select public.create_team_player(pg_temp.id(11),'Other owner')$q$,'42501','foreign personal team rejected');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select pg_temp.check_true(not exists(select 1 from public.teams where id=pg_temp.id(13)),'foreign team UUID remains hidden');
select pg_temp.rejects(format($q$insert into public.team_players(team_id,player_id) values(pg_temp.id(11),%L)$q$,:'other_player'),'42501','foreign player cannot be associated');
select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(12),'2026-10-22 19:30:00+02',' Friendly ','post_match') as created \gset
select (:'created'::jsonb->>'match_id') as match_id, (:'created'::jsonb->>'analysis_id') as analysis_id \gset
select pg_temp.check_true(:'match_id'::uuid is not null and :'analysis_id'::uuid is not null,'returns both IDs');
select pg_temp.check_true((select scope='personal' and created_by=auth.uid() and status='scheduled' and home_team_id=pg_temp.id(11) and away_team_id=pg_temp.id(12) from public.matches where id=:'match_id'),'match identity and ownership');
select pg_temp.check_true((select scheduled_at='2026-10-22 17:30:00+00'::timestamptz and round_label='Friendly' from public.matches where id=:'match_id'),'timestamp instant and round label');
select pg_temp.check_true((select competition_edition_id is null and competition_phase_id is null and venue_id is null from public.matches where id=:'match_id'),'no competition or venue required');
select pg_temp.check_true((select owner_user_id=auth.uid() and match_id=:'match_id' and mode='post_match' and status='draft' and visibility='private' from public.analyses where id=:'analysis_id'),'canonical analysis identity/defaults');
select pg_temp.check_true((select count(*)=2 and min(number)=1 and max(number)=2 and min(sort_order)=0 and max(sort_order)=1 and bool_and(expected_duration_seconds=1800) from public.analysis_periods where analysis_id=:'analysis_id'),'two canonical periods');
select pg_temp.check_true(not exists(select 1 from public.analysis_participants where analysis_id=:'analysis_id'),'persistent roster not automatically called up');
select public.create_personal_match_analysis(pg_temp.id(10),pg_temp.id(11),'2026-12-01 19:00+01',p_mode=>'live') as live_created \gset
select pg_temp.check_true((select mode='live' from public.analyses where id=(:'live_created'::jsonb->>'analysis_id')::uuid),'official team reusable and live mode');
select pg_temp.check_true((select round_label is null from public.matches where id=(:'live_created'::jsonb->>'match_id')::uuid),'round label optional');
select public.create_analysis(pg_temp.id(30),p_mode=>'live') as existing_analysis \gset
select pg_temp.check_true((select mode='live' and match_id=pg_temp.id(30) from public.analyses where id=:'existing_analysis'),'existing official match flow unchanged');
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(11),now())$q$,'23514','same team rejected');
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(13),now())$q$,'42501','foreign hidden away team rejected');
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(13),pg_temp.id(11),now())$q$,'42501','foreign hidden home team rejected');
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(999),now())$q$,'42501','unknown team rejected for match');
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(12),null)$q$,'22023','missing date rejected');
select count(*) as before_matches from public.matches \gset
select count(*) as before_analyses from public.analyses \gset
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(12),now(),p_mode=>'invalid')$q$,'23514','create_analysis failure rolls back match INSERT');
select pg_temp.check_true((select count(*)=:'before_matches' from public.matches),'no orphan match after rollback');
select pg_temp.check_true((select count(*)=:'before_analyses' from public.analyses),'no partial analysis after rollback');
-- Force a later failure in canonical period creation to prove the full composition.
set local role postgres;
create function pg_temp.fail_period() returns trigger language plpgsql as $$begin raise exception 'fixture period failure' using errcode='23514'; end$$;
create trigger test_fail_period before insert on public.analysis_periods for each row execute function pg_temp.fail_period();
set local role authenticated;
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(12),now())$q$,'23514','late period failure rolls back composition');
select pg_temp.check_true((select count(*)=:'before_matches' from public.matches) and (select count(*)=:'before_analyses' from public.analyses),'late failure leaves no match or analysis');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.rejects($q$select public.create_team_player(pg_temp.id(11),'Anon')$q$,'42501','player RPC requires uid');
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(12),now())$q$,'42501','match RPC requires uid');
set local role anon;
select pg_temp.rejects($q$select public.create_team_player(pg_temp.id(11),'Anon')$q$,'42501','anon cannot execute player RPC');
select pg_temp.rejects($q$select public.create_personal_match_analysis(pg_temp.id(11),pg_temp.id(12),now())$q$,'42501','anon cannot execute match RPC');
set local role postgres;
select pg_temp.check_true((select bool_and(not prosecdef and proconfig @> array['search_path=""']) from pg_proc where oid in('public.create_team_player(uuid,text,text,integer,text)'::regprocedure,'public.create_personal_match_analysis(uuid,uuid,timestamptz,text,text)'::regprocedure)),'both RPCs invoker with empty search path');
rollback;
