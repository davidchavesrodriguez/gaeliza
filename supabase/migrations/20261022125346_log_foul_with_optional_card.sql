-- Compose canonical writes in one caller transaction, retaining all RLS/guards.
create function public.log_foul_with_optional_card(
    p_analysis_id uuid, p_period_id uuid, p_team_id uuid,
    p_second_in_period integer,
    p_x numeric default null, p_y numeric default null,
    p_detail jsonb default '{}', p_participants jsonb default '[]',
    p_card_type text default null, p_card_recipient_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare foul_id uuid; card_id uuid;
begin
    if (select auth.uid()) is null then
        raise exception 'authentication required' using errcode = '42501';
    end if;
    if p_card_type is null and p_card_recipient_id is not null then
        raise exception 'recipient requires a card' using errcode = '22023';
    end if;
    foul_id := public.log_event(p_analysis_id, p_period_id, p_team_id, 'foul',
        p_second_in_period, p_x => p_x, p_y => p_y,
        p_detail => p_detail, p_participants => p_participants);
    if p_card_type is not null then
        if p_card_type not in ('yellow', 'black', 'red') then
            raise exception 'invalid card type' using errcode = '23514';
        end if;
        card_id := public.log_event(p_analysis_id, p_period_id, p_team_id, 'card',
            p_second_in_period, p_x => null, p_y => null,
            p_detail => jsonb_build_object('card_type', p_card_type, 'related_foul_event_id', foul_id),
            p_participants => case when p_card_recipient_id is null then '[]'::jsonb
                else jsonb_build_array(jsonb_build_object('participant_id', p_card_recipient_id, 'role', 'card_recipient')) end);
    end if;
    return jsonb_build_object('foul_event_id', foul_id, 'card_event_id', card_id);
end;
$$;
revoke all on function public.log_foul_with_optional_card(uuid,uuid,uuid,integer,numeric,numeric,jsonb,jsonb,text,uuid) from public, anon;
grant execute on function public.log_foul_with_optional_card(uuid,uuid,uuid,integer,numeric,numeric,jsonb,jsonb,text,uuid) to authenticated;
