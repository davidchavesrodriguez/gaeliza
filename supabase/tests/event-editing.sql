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

-- Compact fixture IDs keep scenarios readable; all calls use real caller RLS.
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
 select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.capture(kind text, detail jsonb default '{}', roles jsonb default '[]') returns uuid language sql as $$
 select public.log_event(pg_temp.id(40),pg_temp.id(50),pg_temp.id(10),kind,10,p_detail=>detail,p_participants=>roles) $$;
create function pg_temp.edit(id uuid, detail jsonb default '{}', roles jsonb default '[]', team uuid default pg_temp.id(10), second integer default 25, x numeric default 0, y numeric default 0, period uuid default pg_temp.id(50)) returns uuid language sql as $$
 select public.update_event(pg_temp.id(40),id,team,period,second,(select updated_at from public.events where events.id = $1),x,y,detail,roles) $$;
insert into public.analysis_participants(id,analysis_id,team_id,display_name_snapshot) values
 (pg_temp.id(62),pg_temp.id(40),pg_temp.id(10),'Home second');
insert into public.analysis_periods(id,analysis_id,number,sort_order) values(pg_temp.id(51),pg_temp.id(40),2,1);
select pg_temp.capture('shot','{"result":"point","technique":"hand","situation":"free"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"shooter"}]') as shot \gset
update public.events set notes='Preserve note',sort_order=7 where id=:'shot';
select pg_temp.check_true(pg_temp.edit(:'shot','{"result":"goal","technique":"foot","situation":"penalty"}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"shooter"}]')=:'shot','edit returns same identity');
select pg_temp.check_true((select second_in_period=25 and x=0 and y=0 and possession_id is null and notes='Preserve note' and sort_order=7 from public.events where id=:'shot'),'clock, raw zero coordinates and unowned fields preserved without possession');
select pg_temp.check_true((select count(*)=1 from public.events),'update never creates a second physical event');
select pg_temp.check_true((select shot_result='goal' and shot_technique='foot' and shot_situation='penalty' and score_value=3 from public.analysis_event_facts where event_id=:'shot'),'facts reflect new typed detail');
select pg_temp.check_true((select goals=1 and points=0 and total_score=3 from public.analysis_team_stats where team_id=pg_temp.id(10)),'team analytics replace old point with goal');
select pg_temp.check_true((select goals=1 and points=0 from public.analysis_player_stats where analysis_participant_id=pg_temp.id(60)),'player analytics replace old result');
select pg_temp.edit(:'shot','{"result":"wide"}','[]',pg_temp.id(10),30,12,34);
select pg_temp.check_true((select x=12 and y=34 and second_in_period=30 from public.events where id=:'shot'),'nonzero coordinates editable');
select pg_temp.rejects(format('update public.events set event_type=''pass'' where id=%L',:'shot'),'23514','event_type immutable including direct writes');
select pg_temp.rejects(format('select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),0,''2000-01-01''::timestamptz)',:'shot'),'40001','stale version rejected');
select pg_temp.rejects(format('select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),0,null)',:'shot'),'22023','missing expected version rejected');
select pg_temp.rejects(format('select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),0,now())',pg_temp.id(999)),'42501','event must belong to requested analysis');
select pg_temp.capture('pass','{"result":"completed"}','[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"receiver"}]') as pass \gset
select pg_temp.edit(:'pass','{"result":"intercepted","technique":"foot","end_x":0,"end_y":0}', '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"intended_receiver"},{"participant_id":"00000000-0000-0000-0000-000000000061","role":"interceptor"}]');
select pg_temp.check_true((select result='intercepted' and end_x=0 and end_y=0 from public.pass_events where event_id=:'pass'),'pass result and destination zero edited');
select pg_temp.check_true((select count(*)=2 and bool_and(role in ('intended_receiver','interceptor')) from public.event_participants where event_id=:'pass'),'receiver replaced atomically by intended receiver and opposing interceptor');
select pg_temp.check_true((select completed_passes=0 and intercepted_passes_lost=1 from public.analysis_team_stats where team_id=pg_temp.id(10)),'pass analytics remove old completed result');
select pg_temp.check_true((select receptions=0 from public.analysis_player_stats where analysis_participant_id=pg_temp.id(60)),'old receiver reception disappears');
select pg_temp.check_true((select interceptions=1 from public.analysis_player_stats where analysis_participant_id=pg_temp.id(61)),'opponent gets new interception');
select pg_temp.edit(:'pass','{"result":"completed"}','[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"receiver"}]',pg_temp.id(20));
select pg_temp.check_true((select e.team_id=pg_temp.id(20) and ep.analysis_participant_id=pg_temp.id(61) from public.events e join public.event_participants ep on ep.event_id=e.id where e.id=:'pass'),'team change clears old roles before validating new roles');
select pg_temp.rejects(format('select pg_temp.edit(%L,''{"result":"incomplete"}'',''[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"receiver"}]'',pg_temp.id(20))',:'pass'),'23514','inconsistent pass receiver payload rejected');
select pg_temp.rejects(format('select pg_temp.edit(%L,''{"result":"intercepted"}'',''[{"participant_id":"00000000-0000-0000-0000-000000000061","role":"interceptor"}]'',pg_temp.id(20))',:'pass'),'23514','interceptor cannot belong to event team');

-- Failed role insertion must restore base, detail, previous roles AND inferred link.
insert into public.possessions(id,analysis_id,team_id,period_id,start_second,source) values(pg_temp.id(80),pg_temp.id(40),pg_temp.id(20),pg_temp.id(50),0,'inferred');
update public.events set possession_id=pg_temp.id(80) where id=:'pass';
select pg_temp.rejects(format('select pg_temp.edit(%L,''{"result":"wide"}'',''[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"offender"}]'',pg_temp.id(10),99)',:'shot'),'23514','invalid role rejected after base/detail writes');
select pg_temp.rejects(format('select pg_temp.edit(%L,''{"result":"incomplete"}'',''[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"offender"}]'',pg_temp.id(10),99)',:'pass'),'23514','late participant failure rolls whole RPC back');
select pg_temp.check_true((select team_id=pg_temp.id(20) and second_in_period=25 and possession_id=pg_temp.id(80) from public.events where id=:'pass'),'rollback restores base and possession association');
select pg_temp.check_true((select result='completed' from public.pass_events where event_id=:'pass') and (select role='receiver' and analysis_participant_id=pg_temp.id(61) from public.event_participants where event_id=:'pass'),'rollback restores detail and original role');
select pg_temp.edit(:'pass','{"result":"incomplete"}','[]',pg_temp.id(10),50,0,0,pg_temp.id(51));
select pg_temp.check_true((select possession_id is null and period_id=pg_temp.id(51) and second_in_period=50 from public.events where id=:'pass'),'successful period/team/clock change detaches inferred association');
select pg_temp.check_true((select count(*)=1 and bool_and(source='inferred' and team_id=pg_temp.id(20)) from public.possessions),'editing does not rebuild or remove inferred possessions');
insert into public.possessions(id,analysis_id,team_id,period_id,start_second,end_second,source) values(pg_temp.id(81),pg_temp.id(40),pg_temp.id(10),pg_temp.id(50),0,100,'manual');
update public.events set possession_id=pg_temp.id(81) where id=:'shot';
select pg_temp.rejects(format('select pg_temp.edit(%L,''{"result":"goal"}'',''[]'',pg_temp.id(20),99)',:'shot'),'55000','ambiguous manual-linked edit rejected explicitly');
select pg_temp.check_true((select source='manual' and team_id=pg_temp.id(10) and start_second=0 and end_second=100 from public.possessions where id=pg_temp.id(81)) and (select possession_id=pg_temp.id(81) and second_in_period=30 from public.events where id=:'shot'),'manual possession and linked event remain unchanged');
select pg_temp.rejects(format('select pg_temp.edit(%L,''{"result":"wide"}'',''[]'',pg_temp.id(10),30,0,0)',:'shot'),'55000','conservative manual policy also rejects coordinate-only edit');

select pg_temp.capture('foul','{"cause":"holding","outcome":"free"}') as foul \gset
select pg_temp.capture('card','{"card_type":"yellow"}') as card \gset
update public.card_events set related_foul_event_id=:'foul' where event_id=:'card';
select pg_temp.edit(:'card','{"card_type":"red","related_foul_event_id":null}');
select pg_temp.check_true((select card_type='red' and related_foul_event_id=:'foul' from public.card_events where event_id=:'card'),'card relation preserved even when payload attempts null');
select pg_temp.capture('substitution') as substitution \gset
select pg_temp.rejects(format('select pg_temp.edit(%L,''{}'',''[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"player_out"},{"participant_id":"00000000-0000-0000-0000-000000000060","role":"player_in"}]'')',:'substitution'),'23514','identical substitution in/out rejected');
select pg_temp.capture('goalkeeper_change') as goalkeeper \gset
select pg_temp.rejects(format('select pg_temp.edit(%L,''{}'',''[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper_out"},{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper_in"}]'')',:'goalkeeper'),'23514','identical goalkeeper in/out rejected');
select pg_temp.edit(:'substitution','{}','[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"player_out"},{"participant_id":"00000000-0000-0000-0000-000000000062","role":"player_in"}]');
select pg_temp.edit(:'goalkeeper','{}','[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"goalkeeper_out"},{"participant_id":"00000000-0000-0000-0000-000000000062","role":"goalkeeper_in"}]');
select pg_temp.check_true((select count(*)=4 from public.event_participants where event_id in (:'substitution',:'goalkeeper')),'valid replacement role edits succeed');

-- Remaining typed editors including formerly hidden kickout coordinates.
select pg_temp.capture('kickout') as kickout \gset
select pg_temp.edit(:'kickout','{"length":"long","result":"retained","end_x":0,"end_y":0}');
select pg_temp.check_true((select length='long' and result='retained' and end_x=0 and end_y=0 from public.kickout_events where event_id=:'kickout'),'kickout typed detail and zero destination editable');
select pg_temp.edit(:'foul','{"cause":"trip","outcome":"penalty"}');
select pg_temp.check_true((select cause='trip' and outcome='penalty' from public.foul_events where event_id=:'foul'),'foul cause and outcome editable');
select pg_temp.capture('recovery') as recovery \gset
select pg_temp.edit(:'recovery','{"method":"tackle"}');
select pg_temp.check_true((select method='tackle' from public.recovery_events where event_id=:'recovery'),'recovery method editable');
select pg_temp.capture('turnover') as turnover \gset
select pg_temp.edit(:'turnover','{"cause":"steps"}');
select pg_temp.check_true((select cause='steps' from public.turnover_events where event_id=:'turnover'),'turnover cause editable');
select pg_temp.capture('duel') as duel \gset
select pg_temp.edit(:'duel','{"duel_type":"aerial"}');
select pg_temp.check_true((select duel_type='aerial' from public.duel_events where event_id=:'duel'),'duel type editable');
select pg_temp.capture('dribble') as dribble \gset
select pg_temp.edit(:'dribble','{"result":"successful"}');
select pg_temp.check_true((select result='successful' from public.dribble_events where event_id=:'dribble'),'dribble result editable');
select pg_temp.capture('restart') as restart \gset
select pg_temp.edit(:'restart','{"restart_type":"sideline"}');
select pg_temp.check_true((select restart_type='sideline' from public.restart_events where event_id=:'restart'),'restart detail editable');
select pg_temp.capture('block') as block \gset
select pg_temp.edit(:'block','{}','[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"blocker"}]');
select pg_temp.check_true((select count(*)=1 from public.event_participants where event_id=:'block'),'standalone block roles editable');
update public.analyses set status='completed' where id=pg_temp.id(40);
select pg_temp.rejects(format('select pg_temp.edit(%L)',:'pass'),'23514','completed analysis rejects atomic edit');
update public.analyses set status='in_progress',visibility='public' where id=pg_temp.id(40);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.check_true((select count(*)>0 from public.analysis_event_facts),'other user can view public analysis for permission regression');
select pg_temp.rejects(format('select pg_temp.edit(%L)',:'pass'),'42501','public visibility does not allow another user to edit');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.rejects(format('select pg_temp.edit(%L)',:'pass'),'42501','anon cannot execute RPC');
set local role authenticated;
select pg_temp.rejects(format('select pg_temp.edit(%L)',:'pass'),'42501','authenticated role without uid rejected');
select pg_temp.check_true(not has_function_privilege('anon','public.update_event(uuid,uuid,uuid,uuid,integer,timestamptz,numeric,numeric,jsonb,jsonb)','EXECUTE'),'no anonymous execute grant');
rollback;
