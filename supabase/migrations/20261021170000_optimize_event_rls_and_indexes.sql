-- Gaeliza v2 - remove duplicate permissive SELECT policies and cover FK index.

create index event_participants_event_analysis_idx
    on public.event_participants (event_id, analysis_id);

do $$
declare
    v_table text;
    v_tables text[] := array[
        'shot_events',
        'pass_events',
        'recovery_events',
        'turnover_events',
        'duel_events',
        'dribble_events',
        'foul_events',
        'card_events',
        'kickout_events',
        'restart_events'
    ];
begin
    foreach v_table in array v_tables loop
        execute format('drop policy if exists %I on public.%I', v_table || '_write', v_table);

        execute format(
            'create policy %I on public.%I for insert to authenticated with check (
                exists (
                    select 1
                    from public.events e
                    join public.analyses a on a.id = e.analysis_id
                    where e.id = event_id
                      and a.owner_user_id = (select auth.uid())
                )
            )',
            v_table || '_insert_owner',
            v_table
        );

        execute format(
            'create policy %I on public.%I for update to authenticated using (
                exists (
                    select 1
                    from public.events e
                    join public.analyses a on a.id = e.analysis_id
                    where e.id = event_id
                      and a.owner_user_id = (select auth.uid())
                )
            ) with check (
                exists (
                    select 1
                    from public.events e
                    join public.analyses a on a.id = e.analysis_id
                    where e.id = event_id
                      and a.owner_user_id = (select auth.uid())
                )
            )',
            v_table || '_update_owner',
            v_table
        );

        execute format(
            'create policy %I on public.%I for delete to authenticated using (
                exists (
                    select 1
                    from public.events e
                    join public.analyses a on a.id = e.analysis_id
                    where e.id = event_id
                      and a.owner_user_id = (select auth.uid())
                )
            )',
            v_table || '_delete_owner',
            v_table
        );
    end loop;
end;
$$;
