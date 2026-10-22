-- Disposable local v2 DB only. Verify the new kickout capture payload contract.
\ir fixtures/editing.sql
select public.log_event(pg_temp.id(40),pg_temp.id(50),pg_temp.id(10),'kickout',0,
 p_x=>null,p_y=>null,p_detail=>'{"length":"short","result":"retained","end_x":0,"end_y":0}') as kickout_id \gset
select pg_temp.check_true((select raw_x is null and raw_y is null from public.analysis_event_facts where event_id=:'kickout_id'),'new kickout has no origin in facts');
select pg_temp.check_true((select kickout_raw_end_x=0 and kickout_raw_end_y=0 from public.analysis_event_facts where event_id=:'kickout_id'),'kickout destination zero remains valid');
select pg_temp.check_true((select kickouts=1 and kickouts_retained=1 from public.analysis_team_stats where team_id=pg_temp.id(10)),'kickout analytics count an origin-free retained kickout');
-- Editing an old fixture follows the same new payload contract; no bulk rewrite.
select public.log_event(pg_temp.id(40),pg_temp.id(50),pg_temp.id(10),'kickout',10,
 p_x=>25,p_y=>50,p_detail=>'{"length":"short","result":"retained"}') as old_kickout_id \gset
select public.update_event(pg_temp.id(40),:'old_kickout_id',pg_temp.id(10),pg_temp.id(50),10,
 (select updated_at from public.events where id=:'old_kickout_id'),null,null,
 '{"length":"short","result":"retained","end_x":0,"end_y":0}','[]');
select pg_temp.check_true((select raw_x is null and raw_y is null and kickout_raw_end_x=0 and kickout_raw_end_y=0 from public.analysis_event_facts where event_id=:'old_kickout_id'),'edited historical kickout clears only origin and keeps destination zero');
select pg_temp.check_true((select kickouts=2 and kickouts_retained=2 from public.analysis_team_stats where team_id=pg_temp.id(10)),'edited origin-free kickout remains in analytics');
rollback;
