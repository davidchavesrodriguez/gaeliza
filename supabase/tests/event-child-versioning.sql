-- Disposable local database only; this suite rolls back all fixtures.
\ir fixtures/editing.sql

-- No sleeps: assert strict advancement even within a transaction, where now()
-- is constant. The same stale token must also fail across HTTP transactions.
create function pg_temp.change_and_conflict(id uuid, command text, label text) returns void
language plpgsql as $$
declare snapshot public.events%rowtype;
begin
 select * into strict snapshot from public.events e where e.id=$1;
 execute command;
 perform pg_temp.check_true((select updated_at > snapshot.updated_at from public.events e where e.id=$1),label || ': parent version advances');
 perform pg_temp.rejects(format('select public.update_event(%L,%L,%L,%L,%s,%L)',
  snapshot.analysis_id,snapshot.id,snapshot.team_id,snapshot.period_id,snapshot.second_in_period,snapshot.updated_at),
  '40001',label || ': stale editor conflicts');
end$$;

-- Every typed table: all three operations invalidate a loaded snapshot; an
-- UPDATE assigning identical values does not incur a parent write/version bump.
do $$
declare fixture record; event_id uuid; before_version timestamptz;
begin
 for fixture in select * from (values
  ('shot','result','point'),('pass','result','completed'),
  ('recovery','method','tackle'),('turnover','cause','steps'),
  ('duel','duel_type','aerial'),('dribble','result','successful'),
  ('foul','cause','holding'),('card','card_type','yellow'),
  ('kickout','length','long'),('restart','restart_type','free')
 ) as fixtures(kind,field,value) loop
  event_id:=pg_temp.capture(fixture.kind);
  perform pg_temp.check_true(event_id is not null,'log_event still creates ' || fixture.kind);
  perform pg_temp.change_and_conflict(event_id,format('update public.%I set %I=%L where event_id=%L',fixture.kind || '_events',fixture.field,fixture.value,event_id),fixture.kind || ' detail-only UPDATE');
  select e.updated_at into before_version from public.events e where e.id=event_id;
  execute format('update public.%I set %I=%I where event_id=%L',fixture.kind || '_events',fixture.field,fixture.field,event_id);
  perform pg_temp.check_true((select e.updated_at=before_version from public.events e where e.id=event_id),fixture.kind || ' no-op UPDATE leaves parent untouched');
  perform pg_temp.change_and_conflict(event_id,format('delete from public.%I where event_id=%L',fixture.kind || '_events',event_id),fixture.kind || ' detail-only DELETE');
  perform pg_temp.change_and_conflict(event_id,format('insert into public.%I(event_id,%I) values(%L,%L)',fixture.kind || '_events',fixture.field,event_id,fixture.value),fixture.kind || ' detail-only INSERT');
 end loop;
end$$;

select pg_temp.capture('shot','{"result":"point"}') as shot \gset
select pg_temp.change_and_conflict(:'shot',format('insert into public.event_participants(event_id,analysis_id,analysis_participant_id,role) values(%L,pg_temp.id(40),pg_temp.id(60),''shooter'')',:'shot'),'participant-only INSERT');
select pg_temp.change_and_conflict(:'shot',format('delete from public.event_participants where event_id=%L',:'shot'),'participant-only DELETE');
insert into public.event_participants(event_id,analysis_id,analysis_participant_id,role) values(:'shot',pg_temp.id(40),pg_temp.id(60),'shooter');
select updated_at as participant_version from public.events where id=:'shot' \gset
-- UPDATE has a table grant but no authenticated UPDATE RLS policy. Preserve
-- that restriction; zero permitted rows must not invalidate the parent.
update public.event_participants set role='assister' where event_id=:'shot';
select pg_temp.check_true((select role='shooter' from public.event_participants where event_id=:'shot') and (select updated_at=:'participant_version'::timestamptz from public.events where id=:'shot'),'authenticated participant UPDATE remains RLS-denied with no version/write');

-- Cover UPDATE machinery with local privileged maintenance, without adding or
-- relaxing a policy. Reassignment must invalidate BOTH former and new parents.
select pg_temp.capture('shot','{"result":"point"}') as other_shot \gset
set local role postgres;
select pg_temp.change_and_conflict(:'shot',format('update public.event_participants set role=''assister'' where event_id=%L',:'shot'),'privileged participant-only UPDATE');
select updated_at as old_parent_version from public.events where id=:'shot' \gset
select pg_temp.change_and_conflict(:'other_shot',format('update public.event_participants set event_id=%L where event_id=%L',:'other_shot',:'shot'),'participant reassignment new parent');
select pg_temp.check_true((select updated_at>:'old_parent_version'::timestamptz from public.events where id=:'shot'),'participant reassignment also versions old parent');
select updated_at as no_op_version from public.events where id=:'other_shot' \gset
update public.event_participants set role=role where event_id=:'other_shot';
select pg_temp.check_true((select updated_at=:'no_op_version'::timestamptz from public.events where id=:'other_shot'),'no-op participant UPDATE does not touch parent');
set local role authenticated;

-- Details without a reassignment prohibition also invalidate both parents.
select pg_temp.capture('recovery') as recovery_old \gset
select pg_temp.capture('recovery') as recovery_new \gset
 delete from public.recovery_events where event_id=:'recovery_new';
select updated_at as old_detail_parent from public.events where id=:'recovery_old' \gset
select pg_temp.change_and_conflict(:'recovery_new',format('update public.recovery_events set event_id=%L where event_id=%L',:'recovery_new',:'recovery_old'),'detail reassignment new parent');
select pg_temp.check_true((select updated_at>:'old_detail_parent'::timestamptz from public.events where id=:'recovery_old'),'detail reassignment versions old parent');

-- ON DELETE SET NULL is a real child change on a surviving card aggregate.
select pg_temp.capture('foul') as related_foul \gset
select pg_temp.capture('card','{"card_type":"yellow"}') as related_card \gset
update public.card_events set related_foul_event_id=:'related_foul' where event_id=:'related_card';
select pg_temp.change_and_conflict(:'related_card',format('delete from public.events where id=%L',:'related_foul'),'related foul deletion versions surviving card');
select pg_temp.check_true((select related_foul_event_id is null from public.card_events where event_id=:'related_card'),'related foul SET NULL cascade remains valid');

-- Current versions save successfully; a previously loaded version cannot save
-- twice, even though all this suite runs within ONE transaction.
select updated_at as current_version from public.events where id=:'shot' \gset
select pg_temp.check_true(public.update_event(pg_temp.id(40),:'shot',pg_temp.id(10),pg_temp.id(50),20,:'current_version',0,0,'{"result":"goal"}',
 '[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"shooter"}]')=:'shot','update_event still saves with current aggregate version');
select pg_temp.check_true((select updated_at>:'current_version'::timestamptz from public.events where id=:'shot'),'RPC advances aggregate version');
select pg_temp.rejects(format('select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),20,%L)',:'shot',:'current_version'),'40001','second RPC with reused token conflicts in same transaction');
select updated_at as rollback_version from public.events where id=:'shot' \gset
select pg_temp.rejects(format('select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),99,%L,1,1,''{"result":"wide"}'',''[{"participant_id":"00000000-0000-0000-0000-000000000060","role":"offender"}]'')',:'shot',:'rollback_version'),'23514','late role failure rolls back all intermediate parent touches');
select pg_temp.check_true((select updated_at=:'rollback_version'::timestamptz and second_in_period=20 and x=0 and y=0 from public.events where id=:'shot') and
 (select result='goal' from public.shot_events where event_id=:'shot') and
 (select role='shooter' from public.event_participants where event_id=:'shot'),'rollback restores parent version, base, detail and roles');

-- Parent-only writes cannot restore a historical client-supplied token.
update public.events set updated_at='2000-01-01' where id=:'shot';
select pg_temp.check_true((select updated_at>:'rollback_version'::timestamptz from public.events where id=:'shot'),'events timestamp trigger ignores client-supplied historical token');
select updated_at as completed_version from public.events where id=:'shot' \gset
update public.analyses set status='completed' where id=pg_temp.id(40);
select pg_temp.rejects(format('update public.shot_events set technique=''foot'' where event_id=%L',:'shot'),'23514','completed rejects detail UPDATE before versioning');
select pg_temp.rejects(format('update public.shot_events set technique=technique where event_id=%L',:'shot'),'23514','completed still rejects a no-op detail UPDATE');
select pg_temp.rejects(format('delete from public.shot_events where event_id=%L',:'shot'),'23514','completed rejects detail DELETE');
select pg_temp.rejects(format('insert into public.shot_events(event_id) values(%L)',:'shot'),'23514','completed rejects detail INSERT');
select pg_temp.rejects(format('delete from public.event_participants where event_id=%L',:'shot'),'23514','completed rejects participant DELETE');
select pg_temp.rejects(format('insert into public.event_participants(event_id,analysis_id,analysis_participant_id,role) values(%L,pg_temp.id(40),pg_temp.id(61),''goalkeeper'')',:'shot'),'23514','completed rejects participant INSERT');
set local role postgres;
select pg_temp.rejects(format('update public.event_participants set role=''assister'' where event_id=%L',:'shot'),'23514','completed rejects even privileged participant UPDATE');
set local role authenticated;
select pg_temp.rejects(format('select public.update_event(pg_temp.id(40),%L,pg_temp.id(10),pg_temp.id(50),20,%L)',:'shot',:'completed_version'),'23514','completed still rejects RPC');
select pg_temp.check_true((select updated_at=:'completed_version'::timestamptz from public.events where id=:'shot'),'rejected completed writes leave version untouched');
select pg_temp.rejects(format('delete from public.events where id=%L',:'shot'),'23514','completed still rejects parent deletion');
update public.analyses set status='in_progress' where id=pg_temp.id(40);

-- Cascaded children see a missing parent and must perform no parent UPDATE.
-- Log touches with a temporary trigger to distinguish zero writes from a write
-- to another surviving event; this test helper rolls back with the fixtures.
set local role postgres;
create temporary table parent_writes(event_id uuid);
grant insert,select on parent_writes to authenticated;
create function pg_temp.record_parent_write() returns trigger language plpgsql as $$begin
 insert into pg_temp.parent_writes values(new.id); return new; end$$;
create trigger test_parent_write after update on public.events for each row execute function pg_temp.record_parent_write();
set local role authenticated;
delete from public.events where id=:'shot';
select pg_temp.check_true(not exists(select 1 from public.events where id=:'shot') and
 not exists(select 1 from public.shot_events where event_id=:'shot') and
 not exists(select 1 from public.event_participants where event_id=:'shot'),'event delete cascades through details and participants');
select pg_temp.check_true(not exists(select 1 from pg_temp.parent_writes),'cascade performs no update of deleted or surviving parents');
-- Existing deferrable roster FK permits full analysis cascade too.
delete from public.analyses where id=pg_temp.id(40);
set constraints all immediate;
select pg_temp.check_true(not exists(select 1 from public.events) and not exists(select 1 from public.event_participants),'analysis cascade still removes all events and roles');
select pg_temp.check_true(not exists(select 1 from pg_temp.parent_writes),'analysis cascade produces no parent version writes');
select pg_temp.check_true(not (select prosecdef from pg_proc where oid='public.update_event(uuid,uuid,uuid,uuid,integer,timestamptz,numeric,numeric,jsonb,jsonb)'::regprocedure),'update_event remains security invoker');
select pg_temp.check_true(not has_function_privilege('authenticated','private.version_event_after_child_change()','EXECUTE'),'child trigger function is not directly callable');
rollback;
