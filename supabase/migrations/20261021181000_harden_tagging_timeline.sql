-- Gaeliza v2 - timeline invariants needed by synchronized tagging.

create unique index video_sync_points_period_second_uidx
    on public.video_sync_points (
        analysis_video_id,
        analysis_period_id,
        second_in_period
    );

create or replace function private.validate_video_sync_monotonicity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Serialize competing anchors for one video before comparing their clocks.
    perform 1 from public.analysis_videos v
     where v.id = new.analysis_video_id for update;

    if exists (
        select 1
        from public.video_sync_points sp
        where sp.analysis_video_id = new.analysis_video_id
          and sp.analysis_period_id = new.analysis_period_id
          and sp.id <> new.id
          and (
              (sp.second_in_period < new.second_in_period and sp.video_second >= new.video_second)
              or
              (sp.second_in_period > new.second_in_period and sp.video_second <= new.video_second)
          )
    ) then
        raise exception 'synchronization points must increase monotonically within the same video and period'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_video_sync_monotonicity() from public, anon, authenticated;

create trigger video_sync_points_validate_monotonicity
before insert or update of analysis_video_id, analysis_period_id, video_second, second_in_period
on public.video_sync_points
for each row execute function private.validate_video_sync_monotonicity();

create or replace function private.ensure_event_analysis_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_analysis_id uuid;
    v_status text;
begin
    v_analysis_id := case when tg_op = 'DELETE' then old.analysis_id else new.analysis_id end;

    select a.status
      into v_status
      from public.analyses a
     where a.id = v_analysis_id
     for update;

    -- A cascading analysis deletion has already removed the parent.
    -- Inserts still rely on their FK to reject missing parents.
    if not found and tg_op = 'DELETE' then
        return old;
    end if;

    if v_status = 'completed' then
        raise exception 'completed analyses must be reopened before editing events'
            using errcode = '23514';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$$;

revoke all on function private.ensure_event_analysis_editable() from public, anon, authenticated;

create trigger events_require_editable_analysis
before insert or update or delete on public.events
for each row execute function private.ensure_event_analysis_editable();

create or replace function private.mark_analysis_in_progress_after_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.analyses
       set status = 'in_progress'
     where id = new.analysis_id
       and status = 'draft';

    return new;
end;
$$;

revoke all on function private.mark_analysis_in_progress_after_event() from public, anon, authenticated;

create trigger events_mark_analysis_in_progress
after insert on public.events
for each row execute function private.mark_analysis_in_progress_after_event();

comment on index public.video_sync_points_period_second_uidx is
'Prevents ambiguous mappings: one video may map a given period second only once.';

-- Detail and participant writes must obey the same completed boundary as events.
-- Check both parents on UPDATE so moving a detail cannot evade the lock.
create or replace function private.ensure_event_child_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_old_id uuid;
    v_new_id uuid;
    v_status text;
begin
    if tg_op <> 'INSERT' then v_old_id := old.event_id; end if;
    if tg_op <> 'DELETE' then v_new_id := new.event_id; end if;

    for v_status in
        select a.status
          from public.analyses a
         where a.id in (
             select e.analysis_id from public.events e
              where e.id in (v_old_id, v_new_id)
         )
         order by a.id
         for update
    loop
        if v_status = 'completed' then
            raise exception 'completed analyses must be reopened before editing events'
                using errcode = '23514';
        end if;
    end loop;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;
revoke all on function private.ensure_event_child_editable() from public, anon, authenticated;

do $$
declare v_table text;
begin
    foreach v_table in array array[
        'shot_events', 'pass_events', 'recovery_events', 'turnover_events',
        'duel_events', 'dribble_events', 'foul_events', 'card_events',
        'kickout_events', 'restart_events', 'event_participants'
    ] loop
        execute format('create trigger event_child_require_editable_analysis
            before insert or update or delete on public.%I
            for each row execute function private.ensure_event_child_editable()', v_table);
    end loop;
end;
$$;
