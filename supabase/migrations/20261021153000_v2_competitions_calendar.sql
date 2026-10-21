-- Gaeliza v2 - seasons, competitions, phases and match calendar

-- ---------------------------------------------------------------------------
-- Seasons
-- ---------------------------------------------------------------------------

create table public.seasons (
    id uuid primary key default gen_random_uuid(),
    name text not null unique check (char_length(btrim(name)) between 1 and 50),
    start_date date,
    end_date date,
    active boolean not null default true,
    source text,
    source_external_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint seasons_date_range_check check (
        start_date is null
        or end_date is null
        or start_date <= end_date
    )
);

create unique index seasons_source_external_id_uidx
    on public.seasons (source, source_external_id)
    where source is not null and source_external_id is not null;

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Competitions and editions
-- ---------------------------------------------------------------------------

create table public.competitions (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(btrim(name)) between 1 and 160),
    short_name text check (short_name is null or char_length(btrim(short_name)) between 1 and 50),
    type text not null check (type in ('league', 'cup', 'tournament', 'friendly', 'other')),
    scope text not null check (scope in ('official', 'personal')),
    owner_user_id uuid references auth.users(id) on delete cascade,
    source text,
    source_external_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint competitions_scope_owner_check check (
        (scope = 'official' and owner_user_id is null)
        or
        (scope = 'personal' and owner_user_id is not null)
    )
);

create table public.competition_editions (
    id uuid primary key default gen_random_uuid(),
    competition_id uuid not null references public.competitions(id) on delete restrict,
    season_id uuid references public.seasons(id) on delete restrict,
    gender text not null check (gender in ('male', 'female', 'mixed')),
    category text check (category is null or char_length(btrim(category)) between 1 and 100),
    source text,
    source_external_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index competitions_source_external_id_uidx
    on public.competitions (source, source_external_id)
    where source is not null and source_external_id is not null;

create unique index competition_editions_source_external_id_uidx
    on public.competition_editions (source, source_external_id)
    where source is not null and source_external_id is not null;

create index competitions_owner_user_id_idx
    on public.competitions (owner_user_id)
    where owner_user_id is not null;

create index competition_editions_competition_id_idx
    on public.competition_editions (competition_id);

create index competition_editions_season_id_idx
    on public.competition_editions (season_id)
    where season_id is not null;

create trigger competitions_set_updated_at
before update on public.competitions
for each row execute function private.set_updated_at();

create trigger competition_editions_set_updated_at
before update on public.competition_editions
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Competition phases
-- ---------------------------------------------------------------------------

create table public.competition_phases (
    id uuid primary key default gen_random_uuid(),
    competition_edition_id uuid not null references public.competition_editions(id) on delete restrict,
    parent_phase_id uuid,
    name text not null check (char_length(btrim(name)) between 1 and 120),
    type text not null check (type in ('league', 'group', 'knockout', 'other')),
    sort_order integer not null default 0 check (sort_order >= 0),
    source text,
    source_external_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, competition_edition_id),
    constraint competition_phases_parent_same_edition_fkey
        foreign key (parent_phase_id, competition_edition_id)
        references public.competition_phases (id, competition_edition_id)
        on delete restrict
);

create unique index competition_phases_source_external_id_uidx
    on public.competition_phases (source, source_external_id)
    where source is not null and source_external_id is not null;

create index competition_phases_edition_sort_idx
    on public.competition_phases (competition_edition_id, sort_order);

create index competition_phases_parent_phase_id_idx
    on public.competition_phases (parent_phase_id)
    where parent_phase_id is not null;

create trigger competition_phases_set_updated_at
before update on public.competition_phases
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Match calendar
-- ---------------------------------------------------------------------------

create table public.matches (
    id uuid primary key default gen_random_uuid(),
    competition_edition_id uuid references public.competition_editions(id) on delete restrict,
    competition_phase_id uuid,
    home_team_id uuid not null references public.teams(id) on delete restrict,
    away_team_id uuid not null references public.teams(id) on delete restrict,
    scheduled_at timestamptz,
    venue_id uuid references public.venues(id) on delete set null,
    round_number integer check (round_number is null or round_number > 0),
    round_label text check (round_label is null or char_length(btrim(round_label)) between 1 and 100),
    status text not null default 'scheduled' check (status in ('scheduled', 'played', 'postponed', 'cancelled')),
    scope text not null check (scope in ('official', 'personal')),
    created_by uuid references auth.users(id) on delete cascade,
    source text,
    source_external_id text,
    official_home_goals integer check (official_home_goals is null or official_home_goals >= 0),
    official_home_points integer check (official_home_points is null or official_home_points >= 0),
    official_away_goals integer check (official_away_goals is null or official_away_goals >= 0),
    official_away_points integer check (official_away_points is null or official_away_points >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint matches_distinct_teams_check check (home_team_id <> away_team_id),
    constraint matches_scope_creator_check check (
        (scope = 'official' and created_by is null)
        or
        (scope = 'personal' and created_by is not null)
    ),
    constraint matches_phase_requires_edition_check check (
        competition_phase_id is null or competition_edition_id is not null
    ),
    constraint matches_official_score_complete_check check (
        (
            official_home_goals is null
            and official_home_points is null
            and official_away_goals is null
            and official_away_points is null
        )
        or
        (
            official_home_goals is not null
            and official_home_points is not null
            and official_away_goals is not null
            and official_away_points is not null
        )
    ),
    constraint matches_phase_same_edition_fkey
        foreign key (competition_phase_id, competition_edition_id)
        references public.competition_phases (id, competition_edition_id)
        on delete restrict
);

create unique index matches_source_external_id_uidx
    on public.matches (source, source_external_id)
    where source is not null and source_external_id is not null;

create index matches_competition_edition_scheduled_at_idx
    on public.matches (competition_edition_id, scheduled_at)
    where competition_edition_id is not null;

create index matches_competition_phase_id_idx
    on public.matches (competition_phase_id)
    where competition_phase_id is not null;

create index matches_home_team_scheduled_at_idx
    on public.matches (home_team_id, scheduled_at);

create index matches_away_team_scheduled_at_idx
    on public.matches (away_team_id, scheduled_at);

create index matches_venue_id_idx
    on public.matches (venue_id)
    where venue_id is not null;

create index matches_created_by_idx
    on public.matches (created_by)
    where created_by is not null;

create trigger matches_set_updated_at
before update on public.matches
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function private.can_read_competition(target_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.competitions c
        where c.id = target_competition_id
          and (
              c.scope = 'official'
              or c.owner_user_id = (select auth.uid())
              or (select private.is_admin())
          )
    );
$$;

create or replace function private.can_manage_competition(target_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.competitions c
        where c.id = target_competition_id
          and (
              c.owner_user_id = (select auth.uid())
              or (select private.is_admin())
          )
    );
$$;

create or replace function private.can_read_edition(target_edition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.competition_editions ce
        join public.competitions c on c.id = ce.competition_id
        where ce.id = target_edition_id
          and (
              c.scope = 'official'
              or c.owner_user_id = (select auth.uid())
              or (select private.is_admin())
          )
    );
$$;

create or replace function private.can_manage_edition(target_edition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.competition_editions ce
        join public.competitions c on c.id = ce.competition_id
        where ce.id = target_edition_id
          and (
              c.owner_user_id = (select auth.uid())
              or (select private.is_admin())
          )
    );
$$;

revoke all on function private.can_read_competition(uuid) from public;
revoke all on function private.can_manage_competition(uuid) from public;
revoke all on function private.can_read_edition(uuid) from public;
revoke all on function private.can_manage_edition(uuid) from public;

grant execute on function private.can_read_competition(uuid) to authenticated;
grant execute on function private.can_manage_competition(uuid) to authenticated;
grant execute on function private.can_read_edition(uuid) to authenticated;
grant execute on function private.can_manage_edition(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_editions enable row level security;
alter table public.competition_phases enable row level security;
alter table public.matches enable row level security;

-- Seasons are a global reference catalog. Only admins manage them.
create policy seasons_select
on public.seasons
for select
to anon, authenticated
using (true);

create policy seasons_insert_admin
on public.seasons
for insert
to authenticated
with check ((select private.is_admin()));

create policy seasons_update_admin
on public.seasons
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

-- Competitions: official rows are public; personal rows are owner/admin only.
create policy competitions_select_anon
on public.competitions
for select
to anon
using (scope = 'official');

create policy competitions_select_authenticated
on public.competitions
for select
to authenticated
using (
    scope = 'official'
    or owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy competitions_insert
on public.competitions
for insert
to authenticated
with check (
    (scope = 'personal' and owner_user_id = (select auth.uid()))
    or (select private.is_admin())
);

create policy competitions_update
on public.competitions
for update
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
)
with check (
    (scope = 'personal' and owner_user_id = (select auth.uid()))
    or (select private.is_admin())
);

-- Editions inherit visibility and management from their competition.
create policy competition_editions_select_anon
on public.competition_editions
for select
to anon
using (
    exists (
        select 1
        from public.competitions c
        where c.id = competition_editions.competition_id
          and c.scope = 'official'
    )
);

create policy competition_editions_select_authenticated
on public.competition_editions
for select
to authenticated
using ((select private.can_read_competition(competition_id)));

create policy competition_editions_insert
on public.competition_editions
for insert
to authenticated
with check ((select private.can_manage_competition(competition_id)));

create policy competition_editions_update
on public.competition_editions
for update
to authenticated
using ((select private.can_manage_competition(competition_id)))
with check ((select private.can_manage_competition(competition_id)));

-- Phases inherit visibility and management from their edition/competition.
create policy competition_phases_select_anon
on public.competition_phases
for select
to anon
using (
    exists (
        select 1
        from public.competition_editions ce
        join public.competitions c on c.id = ce.competition_id
        where ce.id = competition_phases.competition_edition_id
          and c.scope = 'official'
    )
);

create policy competition_phases_select_authenticated
on public.competition_phases
for select
to authenticated
using ((select private.can_read_edition(competition_edition_id)));

create policy competition_phases_insert
on public.competition_phases
for insert
to authenticated
with check ((select private.can_manage_edition(competition_edition_id)));

create policy competition_phases_update
on public.competition_phases
for update
to authenticated
using ((select private.can_manage_edition(competition_edition_id)))
with check ((select private.can_manage_edition(competition_edition_id)));

-- Matches are either global official fixtures or private personal fixtures.
create policy matches_select_anon
on public.matches
for select
to anon
using (scope = 'official');

create policy matches_select_authenticated
on public.matches
for select
to authenticated
using (
    scope = 'official'
    or created_by = (select auth.uid())
    or (select private.is_admin())
);

create policy matches_insert
on public.matches
for insert
to authenticated
with check (
    (select private.is_admin())
    or (
        scope = 'personal'
        and created_by = (select auth.uid())
        and (
            competition_edition_id is null
            or (select private.can_read_edition(competition_edition_id))
        )
        and exists (
            select 1
            from public.teams t
            where t.id = matches.home_team_id
        )
        and exists (
            select 1
            from public.teams t
            where t.id = matches.away_team_id
        )
        and (
            venue_id is null
            or exists (
                select 1
                from public.venues v
                where v.id = matches.venue_id
            )
        )
    )
);

create policy matches_update
on public.matches
for update
to authenticated
using (
    created_by = (select auth.uid())
    or (select private.is_admin())
)
with check (
    (select private.is_admin())
    or (
        scope = 'personal'
        and created_by = (select auth.uid())
        and (
            competition_edition_id is null
            or (select private.can_read_edition(competition_edition_id))
        )
        and exists (
            select 1
            from public.teams t
            where t.id = matches.home_team_id
        )
        and exists (
            select 1
            from public.teams t
            where t.id = matches.away_team_id
        )
        and (
            venue_id is null
            or exists (
                select 1
                from public.venues v
                where v.id = matches.venue_id
            )
        )
    )
);

create policy matches_delete
on public.matches
for delete
to authenticated
using (
    (scope = 'personal' and created_by = (select auth.uid()))
    or (select private.is_admin())
);

-- ---------------------------------------------------------------------------
-- Explicit Data API privileges
-- ---------------------------------------------------------------------------

revoke all on table
    public.seasons,
    public.competitions,
    public.competition_editions,
    public.competition_phases,
    public.matches
from anon, authenticated;

grant select on table
    public.seasons,
    public.competitions,
    public.competition_editions,
    public.competition_phases,
    public.matches
to anon;

grant select, insert, update on table
    public.seasons,
    public.competitions,
    public.competition_editions,
    public.competition_phases
to authenticated;

grant select, insert, update, delete on table public.matches to authenticated;

comment on table public.seasons is 'Global season catalog, e.g. 2026/27.';
comment on table public.competitions is 'Competition identity, separate from a particular season/edition.';
comment on table public.competition_editions is 'A competition in a specific season and gender/category.';
comment on table public.competition_phases is 'Hierarchical phases/groups/knockout sections within one competition edition.';
comment on table public.matches is 'Global official fixtures or private personal fixtures. Analytical events live in separate analysis tables.';
