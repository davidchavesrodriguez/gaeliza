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

-- Extended canonical event semantics. Local disposable PostgreSQL only.
create function pg_temp.capture(kind text, detail jsonb default '{}', participants jsonb default '[]') returns uuid
language sql as $$ select public.log_event(
 '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000050',
 '00000000-0000-0000-0000-000000000010', kind, 0,
 p_detail => detail, p_participants => participants) $$;

select pg_temp.rejects($$select pg_temp.capture('pass','{"result":"incomplete"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"receiver"}]')$$, '23514', 'incomplete pass cannot count a reception');
select pg_temp.rejects($$select pg_temp.capture('pass','{"result":"completed"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"intended_receiver"}]')$$, '23514', 'completed pass uses receiver instead of intended_receiver');
select pg_temp.rejects($$select pg_temp.capture('pass','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"receiver"}]')$$, '23514', 'unknown pass result cannot assert a reception');
select pg_temp.capture('pass','{"result":"completed","technique":"foot","end_x":0,"end_y":0}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"receiver"}]') as completed_id \gset
select pg_temp.capture('pass','{"result":"incomplete","technique":"hand"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"intended_receiver"}]') as incomplete_id \gset
select pg_temp.capture('pass','{"result":"intercepted"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"passer"},{"participant_id":"00000000-0000-0000-0000-000000000061","role":"interceptor"}]') as intercepted_id \gset
select pg_temp.check_true((select end_x = 0 and end_y = 0 from public.pass_events where event_id = :'completed_id'), 'pass destination zero survives RPC');
select pg_temp.check_true((select count(*) = 3 from public.events), 'three passes create exactly three physical events');
select pg_temp.check_true((select count(*) = 0 from public.events where event_type in ('recovery','turnover')), 'interception never creates recovery or turnover');
select pg_temp.check_true((select passes = 3 and completed_passes = 1 and intercepted_passes_lost = 1 and explicit_recoveries = 0 and explicit_turnovers = 0 from public.analysis_team_stats where team_id = '00000000-0000-0000-0000-000000000010'), 'team pass analytics reflect canonical events');
select pg_temp.check_true((select interceptions_won = 1 from public.analysis_team_stats where team_id = '00000000-0000-0000-0000-000000000020'), 'opponent credited with interception');
select pg_temp.check_true((select receptions = 1 and passes = 1 and completed_passes = 0 from public.analysis_player_stats where analysis_participant_id = '00000000-0000-0000-0000-000000000060'), 'player analytics count reception and passer only in their roles');
select pg_temp.check_true((select interceptions = 1 from public.analysis_player_stats where analysis_participant_id = '00000000-0000-0000-0000-000000000061'), 'temporary interceptor analytics');
select pg_temp.rejects(format('update public.pass_events set result = ''incomplete'' where event_id = %L', :'completed_id'), '23514', 'result edit cannot invalidate receiver');
select pg_temp.rejects(format('update public.pass_events set result = ''completed'' where event_id = %L', :'incomplete_id'), '23514', 'result edit cannot invalidate intended receiver');
select pg_temp.rejects(format('delete from public.pass_events where event_id = %L', :'completed_id'), '23514', 'detail deletion cannot orphan receiver');
select pg_temp.rejects($$select pg_temp.capture('pass','{"result":"intercepted"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"interceptor"}]')$$, '23514', 'interceptor must be opponent');
select pg_temp.rejects($$select pg_temp.capture('pass','{"end_x":0}')$$, '23514', 'pass destination half pair rejected');
select pg_temp.rejects($$select pg_temp.capture('kickout','{"end_y":0}')$$, '23514', 'kickout destination half pair rejected');
select pg_temp.capture('kickout','{"end_x":0,"end_y":0}');

select pg_temp.capture('duel','{"duel_type":"aerial"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"duel_winner"},{"participant_id":"00000000-0000-0000-0000-000000000061","role":"duel_loser"}]');
select pg_temp.capture('duel','{"duel_type":"ground"}');
select pg_temp.capture('duel','{"duel_type":"other"}');
select pg_temp.rejects($$select pg_temp.capture('duel','{"duel_type":"invalid"}')$$, '23514', 'duel type checked');
select pg_temp.rejects($$select pg_temp.capture('duel','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"duel_winner"}]')$$, '23514', 'duel winner must be event team');
select pg_temp.rejects($$select pg_temp.capture('duel','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"duel_loser"}]')$$, '23514', 'duel loser must be opponent');
select pg_temp.capture('dribble','{"result":"successful"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"dribbler"},{"participant_id":"00000000-0000-0000-0000-000000000061","role":"defender"}]');
select pg_temp.capture('dribble','{"result":"failed"}');
select pg_temp.rejects($$select pg_temp.capture('dribble','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"defender"}]')$$, '23514', 'defender must be opponent');
select pg_temp.rejects($$select pg_temp.capture('dribble','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"dribbler"}]')$$, '23514', 'dribbler must be event team');
select pg_temp.capture('restart','{"restart_type":"sideline"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"restart_taker"}]');
select pg_temp.rejects($$select pg_temp.capture('restart','{"restart_type":"invented"}')$$, '23514', 'restart type checked');

-- Add another temporary home participant, without changing initial goalkeeper.
insert into public.analysis_participants(id, analysis_id, team_id, display_name_snapshot, number, initial_goalkeeper) values
 ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', 'Incoming', 12, false);
update public.analysis_participants set initial_goalkeeper = true, number = 1 where id = '00000000-0000-0000-0000-000000000060';
select pg_temp.capture('substitution','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"player_out"},{"participant_id":"00000000-0000-0000-0000-000000000062","role":"player_in"}]') as sub_id \gset
select pg_temp.capture('goalkeeper_change','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper_out"},{"participant_id":"00000000-0000-0000-0000-000000000062","role":"goalkeeper_in"}]') as gk_id \gset
select pg_temp.capture('substitution','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000062","role":"player_in"}]');
select pg_temp.capture('goalkeeper_change','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper_out"}]');
select pg_temp.rejects($$select pg_temp.capture('substitution','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"player_out"},{"participant_id":"00000000-0000-0000-0000-000000000060","role":"player_in"}]')$$, '23514', 'same player cannot exit and enter in one substitution');
select pg_temp.rejects($$select pg_temp.capture('goalkeeper_change','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper_out"},{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper_in"}]')$$, '23514', 'same goalkeeper cannot exit and enter');
select pg_temp.rejects($$select pg_temp.capture('substitution','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"player_in"}]')$$, '23514', 'incoming player must be event team');
select pg_temp.rejects($$select pg_temp.capture('goalkeeper_change','{}', '[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"goalkeeper_out"}]')$$, '23514', 'outgoing goalkeeper must be event team');
select pg_temp.check_true((select count(*) = 3 from public.analysis_participants), 'replacement events never alter roster membership');
select pg_temp.check_true((select initial_goalkeeper from public.analysis_participants where id = '00000000-0000-0000-0000-000000000060'), 'outgoing initial goalkeeper flag unchanged');
select pg_temp.check_true((select not initial_goalkeeper from public.analysis_participants where id = '00000000-0000-0000-0000-000000000062'), 'incoming initial goalkeeper flag unchanged');
select pg_temp.check_true((select count(distinct event_type) = 6 from public.analysis_event_facts where event_type in ('pass','duel','dribble','restart','substitution','goalkeeper_change')), 'all new types available in facts');

-- Nullable details are allowed by the existing schema: unknown stays unknown.
select pg_temp.capture('pass'); select pg_temp.capture('duel'); select pg_temp.capture('dribble');
select pg_temp.capture('restart'); select pg_temp.capture('substitution'); select pg_temp.capture('goalkeeper_change');
select pg_temp.check_true(public.rebuild_inferred_possessions('00000000-0000-0000-0000-000000000040') > 0, 'existing explicit inference supports extended timeline');
update public.analyses set status = 'completed' where id = '00000000-0000-0000-0000-000000000040';
select pg_temp.rejects($$select pg_temp.capture('pass')$$, '23514', 'completed blocks new pass');
select pg_temp.rejects($$select pg_temp.capture('duel')$$, '23514', 'completed blocks new duel');
select pg_temp.rejects($$select pg_temp.capture('dribble')$$, '23514', 'completed blocks new dribble');
select pg_temp.rejects($$select pg_temp.capture('restart')$$, '23514', 'completed blocks new restart');
select pg_temp.rejects($$select pg_temp.capture('substitution')$$, '23514', 'completed blocks new substitution');
select pg_temp.rejects($$select pg_temp.capture('goalkeeper_change')$$, '23514', 'completed blocks new goalkeeper change');
select pg_temp.rejects(format('delete from public.event_participants where event_id = %L', :'gk_id'), '23514', 'completed blocks goalkeeper role editing');
select pg_temp.rejects(format('update public.pass_events set technique = ''hand'' where event_id = %L', :'completed_id'), '23514', 'completed blocks extended detail editing');
update public.analyses set status = 'in_progress' where id = '00000000-0000-0000-0000-000000000040';
select pg_temp.capture('restart');
delete from public.events where id = :'completed_id';
select pg_temp.check_true((select count(*) = 0 from public.event_participants where event_id = :'completed_id'), 'pass deletion still cascades safely');
rollback;
