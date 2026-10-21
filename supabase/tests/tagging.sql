-- Run ONLY on a disposable local v2 database, after all migrations, as postgres:
-- psql <local-db> -v ON_ERROR_STOP=1 -f supabase/tests/tagging.sql
-- All fixtures and helpers roll back; no Supabase remote is needed.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(condition boolean, label text) returns void
language plpgsql as $$begin
    if condition is distinct from true then raise exception 'FAIL: %', label; end if;
    raise notice 'PASS: %', label;
end$$;
create function pg_temp.rejects(command text, expected_state text, label text) returns void
language plpgsql as $$begin
    begin
        execute command;
    exception when others then
        if sqlstate = expected_state then raise notice 'PASS: %', label; return; end if;
        raise exception 'FAIL: % (expected %, got %: %)', label, expected_state, sqlstate, sqlerrm;
    end;
    raise exception 'FAIL: % (command succeeded)', label;
end$$;

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-000000000001', 'tagging-owner@example.test'),
 ('00000000-0000-0000-0000-000000000002', 'tagging-other@example.test');
insert into public.teams(id, name, gender, scope) values
 ('00000000-0000-0000-0000-000000000010', 'Home test', 'mixed', 'official'),
 ('00000000-0000-0000-0000-000000000020', 'Away test', 'mixed', 'official');
insert into public.matches(id, home_team_id, away_team_id, scope) values
 ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000020', 'official');
insert into public.analyses(id, match_id, owner_user_id) values
 ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001');
insert into public.analysis_periods(id, analysis_id, number) values
 ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000040', 1);
insert into public.analysis_participants(id, analysis_id, team_id, display_name_snapshot) values
 ('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', 'Home temporary'),
 ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000020', 'Away temporary');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

-- Fixtures are deliberately temporary participants (player_id is null).
select pg_temp.check_true((select bool_and(player_id is null) from public.analysis_participants), 'temporary analysis participants supported');
select pg_temp.rejects($$select public.log_event(
 '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000050',
 '00000000-0000-0000-0000-000000000010', 'shot', 0, p_detail => '{"result":"invalid"}'
)$$, '23514', 'invalid first event rolls back atomically');
select pg_temp.check_true((select status = 'draft' from public.analyses where id = '00000000-0000-0000-0000-000000000040'), 'failed first event leaves draft status');
select public.log_event(
 '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000050',
 '00000000-0000-0000-0000-000000000010', 'shot', 0,
 p_x => 0, p_y => 0, p_detail => '{"result":"blocked"}',
 p_participants => '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"shooter"},{"participant_id":"00000000-0000-0000-0000-000000000061","role":"blocker"}]'
) as shot_id \gset
select pg_temp.check_true((select status = 'in_progress' from public.analyses where id = '00000000-0000-0000-0000-000000000040'), 'first event transitions draft atomically');
select pg_temp.check_true((select raw_x = 0 and raw_y = 0 from public.analysis_event_facts where event_id = :'shot_id'), 'zero coordinates survive read model');
select pg_temp.check_true((select count(*) = 1 from public.events), 'blocked shot is one physical event');

select pg_temp.rejects(format('update public.shot_events set result = ''point'' where event_id = %L', :'shot_id'), '23514', 'result cannot invalidate existing blocker');
select pg_temp.rejects(format('update public.events set team_id = ''00000000-0000-0000-0000-000000000020'' where id = %L', :'shot_id'), '23514', 'event team cannot invalidate roles');
select pg_temp.rejects('update public.analysis_participants set team_id = ''00000000-0000-0000-0000-000000000020'' where id = ''00000000-0000-0000-0000-000000000060''', '23514', 'participant team cannot invalidate existing events');


select pg_temp.rejects(format('delete from public.shot_events where event_id = %L', :'shot_id'), '23514', 'detail deletion cannot invalidate blocker');

-- Use a temporary helper that calls the actual invoker RPC, not direct inserts.
create function pg_temp.capture(kind text, detail jsonb default '{}', participants jsonb default '[]', x numeric default null, y numeric default null, second integer default 10) returns uuid
language sql as $$ select public.log_event(
 '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000050',
 '00000000-0000-0000-0000-000000000010', kind, second,
 p_x => x, p_y => y, p_detail => detail, p_participants => participants) $$;

select pg_temp.rejects($$select pg_temp.capture('shot','{"result":"saved"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper"}]')$$, '23514', 'shot goalkeeper must be opponent');
select pg_temp.rejects($$select pg_temp.capture('shot','{"result":"wide"}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"blocker"}]')$$, '23514', 'shot blocker requires blocked result');
select pg_temp.rejects($$select pg_temp.capture('shot','{"result":"point"}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"shooter"}]')$$, '23514', 'shooter must be event team');
select pg_temp.rejects($$select pg_temp.capture('shot','{"result":"wide"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"assister"}]')$$, '23514', 'assister requires scoring result');
select pg_temp.rejects($$select pg_temp.capture('block','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"blocker"}]')$$, '23514', 'standalone blocker must be event team');
select pg_temp.rejects($$select pg_temp.capture('block','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"blocked_player"}]')$$, '23514', 'blocked player must be opponent');
select pg_temp.rejects($$select pg_temp.capture('foul','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"offender"}]')$$, '23514', 'offender must be event team');
select pg_temp.rejects($$select pg_temp.capture('foul','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"fouled"}]')$$, '23514', 'fouled must be opponent');
select pg_temp.rejects($$select pg_temp.capture('card','{"card_type":"blue"}')$$, '23514', 'invalid typed detail rolls back event');
select pg_temp.rejects($$select pg_temp.capture('recovery', x => 0)$$, '23514', 'half coordinate rejected');
select pg_temp.rejects($$select pg_temp.capture('recovery', x => -1, y => 0)$$, '23514', 'out of bounds coordinate rejected');
select pg_temp.rejects($$select pg_temp.capture('recovery', second => -1)$$, '23514', 'negative period clock rejected');
select pg_temp.check_true((select count(*) = 1 from public.events), 'all failed RPCs roll back event, detail, participants');

-- Every MVP type works at team level, without participant identities.
select pg_temp.capture('recovery', '{"method":"loose_ball"}');
select pg_temp.capture('turnover', '{"cause":"bad_pass"}');
select pg_temp.capture('foul', '{"cause":"holding","outcome":"free"}');
select pg_temp.capture('card', '{"card_type":"yellow"}');
select pg_temp.capture('kickout', '{"length":"short","result":"retained"}');
select pg_temp.capture('block');
select pg_temp.check_true((select count(distinct event_type) = 7 from public.events), 'seven MVP event types stored');
select pg_temp.capture('shot', '{"result":"saved"}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"goalkeeper"}]');
select pg_temp.capture('foul', '{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"offender"},{"participant_id":"00000000-0000-0000-0000-000000000061","role":"fouled"}]');
select pg_temp.capture('block', '{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"blocker"},{"participant_id":"00000000-0000-0000-0000-000000000061","role":"blocked_player"}]');
select pg_temp.capture('pass', '{"result":"intercepted"}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"interceptor"}]') as pass_id \gset
select pg_temp.check_true((select count(*) = 11 from public.events), 'intercepted pass stays a single event');
select pg_temp.check_true(pg_temp.capture('block', second => 1801) is not null, 'tagging supports stoppage time beyond nominal duration');
select pg_temp.rejects(format('update public.pass_events set result = ''completed'' where event_id = %L', :'pass_id'), '23514', 'pass result cannot invalidate interceptor');
select pg_temp.check_true(public.rebuild_inferred_possessions('00000000-0000-0000-0000-000000000040') > 0, 'explicit possession reconstruction works');
insert into public.possessions(analysis_id, team_id, period_id, start_second, source) values
 ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000050',0,'manual');
select pg_temp.rejects($$select public.rebuild_inferred_possessions('00000000-0000-0000-0000-000000000040')$$, '23514', 'manual possession corrections are never overwritten');
select pg_temp.check_true((select count(*) = 1 from public.possessions where source = 'manual'), 'manual possession remains intact');

insert into public.analysis_videos(id, analysis_id, url, duration_seconds) values
 ('00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000040','https://example.test/video',3000);
insert into public.video_sync_points(analysis_id, analysis_video_id, analysis_period_id, video_second, second_in_period) values
 ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000050',10,0),
 ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000050',160,100);
select pg_temp.rejects($$insert into public.video_sync_points(analysis_id, analysis_video_id, analysis_period_id, video_second, second_in_period) values ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000050',170,100)$$, '23505', 'duplicate period anchor rejected');
select pg_temp.rejects($$insert into public.video_sync_points(analysis_id, analysis_video_id, analysis_period_id, video_second, second_in_period) values ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000050',5,50)$$, '23514', 'nonmonotonic synchronization rejected');

update public.analyses set status = 'completed' where id = '00000000-0000-0000-0000-000000000040';
select pg_temp.rejects($$select pg_temp.capture('block')$$, '23514', 'completed rejects log_event');
select pg_temp.rejects(format('delete from public.events where id = %L', :'shot_id'), '23514', 'completed rejects deletion');
select pg_temp.rejects(format('update public.events set second_in_period = 1 where id = %L', :'shot_id'), '23514', 'completed rejects event edit');
select pg_temp.rejects(format('update public.shot_events set technique = ''foot'' where event_id = %L', :'shot_id'), '23514', 'completed rejects detail edit');
select pg_temp.rejects(format('delete from public.event_participants where event_id = %L', :'shot_id'), '23514', 'completed rejects participant deletion');
select pg_temp.rejects(format('delete from public.shot_events where event_id = %L', :'shot_id'), '23514', 'completed rejects detail deletion');
select pg_temp.rejects(format('insert into public.event_participants(event_id,analysis_id,analysis_participant_id,role) values (%L,''00000000-0000-0000-0000-000000000040'',''00000000-0000-0000-0000-000000000061'',''goalkeeper'')', :'shot_id'), '23514', 'completed rejects participant insertion');
update public.analyses set status = 'in_progress' where id = '00000000-0000-0000-0000-000000000040';
update public.shot_events set technique = 'foot' where event_id = :'shot_id';
select pg_temp.check_true((select technique = 'foot' from public.shot_events where event_id = :'shot_id'), 'reopening enables edits');

delete from public.events where id = :'shot_id';
select pg_temp.check_true((select count(*) = 0 from public.event_participants where event_id = :'shot_id'), 'event deletion cascades atomically through roles and details');

-- Use the second caller and anon to exercise the real RLS / invoker view.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.check_true((select count(*) = 0 from public.analysis_event_facts), 'other user cannot read private facts');
select pg_temp.rejects($$select pg_temp.capture('block')$$, '42501', 'other user cannot log event');
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.check_true((select count(*) = 0 from public.analysis_event_facts), 'anon cannot read private facts');
select pg_temp.rejects($$select public.log_event('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-000000000010','block',0)$$, '42501', 'anon cannot invoke log_event');
set local role postgres;
update public.analyses set visibility = 'public' where id = '00000000-0000-0000-0000-000000000040';
set local role anon;
select pg_temp.check_true((select count(*) > 0 from public.analysis_event_facts), 'security invoker permits intentionally public facts');
rollback;
