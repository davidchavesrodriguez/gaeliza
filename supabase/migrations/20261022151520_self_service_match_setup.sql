-- Caller privileges and existing RLS apply to every read and write.
create function public.create_team_player(
    p_team_id uuid, p_first_name text, p_last_name text default null,
    p_default_number integer default null, p_primary_position text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_player uuid;
begin
    if v_user is null then
        raise exception 'authentication required' using errcode = '42501';
    end if;
    if not exists (select 1 from public.teams where id=p_team_id
        and scope='personal' and owner_user_id=v_user) then
        raise exception 'own personal team required' using errcode = '42501';
    end if;
    insert into public.players(owner_user_id,first_name,last_name,primary_position)
    values(v_user,btrim(p_first_name),nullif(btrim(p_last_name),''),nullif(btrim(p_primary_position),''))
    returning id into v_player;
    insert into public.team_players(team_id,player_id,default_number)
    values(p_team_id,v_player,p_default_number);
    return v_player;
end;
$$;
revoke all on function public.create_team_player(uuid,text,text,integer,text) from public, anon;
grant execute on function public.create_team_player(uuid,text,text,integer,text) to authenticated;

create function public.create_personal_match_analysis(
    p_home_team_id uuid, p_away_team_id uuid, p_scheduled_at timestamptz,
    p_round_label text default null, p_mode text default 'post_match'
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_match uuid; v_analysis uuid;
begin
    if v_user is null then
        raise exception 'authentication required' using errcode = '42501';
    end if;
    if p_home_team_id = p_away_team_id then
        raise exception 'teams must differ' using errcode = '23514';
    end if;
    if p_scheduled_at is null or not isfinite(p_scheduled_at) then
        raise exception 'scheduled time required' using errcode = '22023';
    end if;
    if (select count(*) from public.teams where id in(p_home_team_id,p_away_team_id)
        and (scope='official' or (scope='personal' and owner_user_id=v_user))) <> 2 then
        raise exception 'accessible teams required' using errcode = '42501';
    end if;
    insert into public.matches(home_team_id,away_team_id,scheduled_at,round_label,
        scope,created_by,status,competition_edition_id,competition_phase_id,venue_id)
    values(p_home_team_id,p_away_team_id,p_scheduled_at,nullif(btrim(p_round_label),''),
        'personal',v_user,'scheduled',null,null,null)
    returning id into v_match;
    v_analysis := public.create_analysis(v_match,p_mode=>p_mode);
    return jsonb_build_object('match_id',v_match,'analysis_id',v_analysis);
end;
$$;
revoke all on function public.create_personal_match_analysis(uuid,uuid,timestamptz,text,text) from public, anon;
grant execute on function public.create_personal_match_analysis(uuid,uuid,timestamptz,text,text) to authenticated;
