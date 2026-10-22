-- Shared transaction, assertions, owner fixtures and capture helper for editing suites.
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

create function pg_temp.id(n integer) returns uuid language sql immutable as $$
 select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.capture(kind text, detail jsonb default '{}', roles jsonb default '[]') returns uuid language sql as $$
 select public.log_event(pg_temp.id(40),pg_temp.id(50),pg_temp.id(10),kind,10,p_detail=>detail,p_participants=>roles) $$;
