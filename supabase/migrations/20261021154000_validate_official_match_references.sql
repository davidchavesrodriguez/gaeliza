-- Gaeliza v2 - enforce semantic integrity for official fixtures.
--
-- RLS controls who may write a match. This trigger additionally guarantees
-- that rows published as global/official fixtures only reference global catalog
-- entities, regardless of whether the write comes from the UI, an import, or a
-- privileged database session.

create or replace function private.validate_official_match_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.scope <> 'official' then
        return new;
    end if;

    if not exists (
        select 1
        from public.teams t
        where t.id = new.home_team_id
          and t.scope = 'official'
    ) then
        raise exception 'Official match home team must be an official team'
            using errcode = '23514';
    end if;

    if not exists (
        select 1
        from public.teams t
        where t.id = new.away_team_id
          and t.scope = 'official'
    ) then
        raise exception 'Official match away team must be an official team'
            using errcode = '23514';
    end if;

    if new.competition_edition_id is not null
       and not exists (
            select 1
            from public.competition_editions ce
            join public.competitions c on c.id = ce.competition_id
            where ce.id = new.competition_edition_id
              and c.scope = 'official'
       ) then
        raise exception 'Official match competition edition must belong to an official competition'
            using errcode = '23514';
    end if;

    if new.venue_id is not null
       and not exists (
            select 1
            from public.venues v
            where v.id = new.venue_id
              and v.scope = 'official'
       ) then
        raise exception 'Official match venue must be an official venue'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_official_match_references() from public, anon, authenticated;

drop trigger if exists matches_validate_official_references on public.matches;

create trigger matches_validate_official_references
before insert or update of
    scope,
    home_team_id,
    away_team_id,
    competition_edition_id,
    venue_id
on public.matches
for each row
execute function private.validate_official_match_references();
