-- Gaeliza v2 - core identity/catalog baseline
--
-- This migration is intentionally written for a CLEAN v2 database.
-- It does not drop or mutate the legacy Gaeliza tables. Applying it directly
-- to the current legacy project will fail on duplicate table names and roll back.
-- The legacy cutover/reset will be handled explicitly once the v2 schema is ready.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Authorization support
-- ---------------------------------------------------------------------------

create table private.user_roles (
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('admin')),
    created_at timestamptz not null default now(),
    primary key (user_id, role)
);

revoke all on table private.user_roles from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from private.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.role = 'admin'
    );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke all on function private.set_updated_at() from public;
grant execute on function private.set_updated_at() to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name, avatar_url)
    values (
        new.id,
        coalesce(
            nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
            nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), '')
        ),
        coalesce(
            nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
            nullif(new.raw_user_meta_data ->> 'picture', '')
        )
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Clubs, venues and teams
-- ---------------------------------------------------------------------------

create table public.clubs (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(btrim(name)) between 1 and 160),
    short_name text check (short_name is null or char_length(btrim(short_name)) between 1 and 50),
    logo_path text,
    scope text not null check (scope in ('official', 'personal')),
    owner_user_id uuid references auth.users(id) on delete cascade,
    source text,
    source_external_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint clubs_scope_owner_check check (
        (scope = 'official' and owner_user_id is null)
        or
        (scope = 'personal' and owner_user_id is not null)
    )
);

create table public.venues (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(btrim(name)) between 1 and 160),
    location text,
    scope text not null check (scope in ('official', 'personal')),
    owner_user_id uuid references auth.users(id) on delete cascade,
    source text,
    source_external_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint venues_scope_owner_check check (
        (scope = 'official' and owner_user_id is null)
        or
        (scope = 'personal' and owner_user_id is not null)
    )
);

create table public.teams (
    id uuid primary key default gen_random_uuid(),
    club_id uuid references public.clubs(id) on delete set null,
    name text not null check (char_length(btrim(name)) between 1 and 160),
    short_name text check (short_name is null or char_length(btrim(short_name)) between 1 and 50),
    gender text not null check (gender in ('male', 'female', 'mixed')),
    logo_path text,
    scope text not null check (scope in ('official', 'personal')),
    owner_user_id uuid references auth.users(id) on delete cascade,
    default_venue_id uuid references public.venues(id) on delete set null,
    source text,
    source_external_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint teams_scope_owner_check check (
        (scope = 'official' and owner_user_id is null)
        or
        (scope = 'personal' and owner_user_id is not null)
    )
);

create trigger clubs_set_updated_at
before update on public.clubs
for each row execute function private.set_updated_at();

create trigger venues_set_updated_at
before update on public.venues
for each row execute function private.set_updated_at();

create trigger teams_set_updated_at
before update on public.teams
for each row execute function private.set_updated_at();

create unique index clubs_source_external_id_uidx
    on public.clubs (source, source_external_id)
    where source is not null and source_external_id is not null;

create unique index venues_source_external_id_uidx
    on public.venues (source, source_external_id)
    where source is not null and source_external_id is not null;

create unique index teams_source_external_id_uidx
    on public.teams (source, source_external_id)
    where source is not null and source_external_id is not null;

create index clubs_owner_user_id_idx on public.clubs (owner_user_id)
    where owner_user_id is not null;

create index venues_owner_user_id_idx on public.venues (owner_user_id)
    where owner_user_id is not null;

create index teams_owner_user_id_idx on public.teams (owner_user_id)
    where owner_user_id is not null;

create index teams_club_id_idx on public.teams (club_id)
    where club_id is not null;

create index teams_default_venue_id_idx on public.teams (default_venue_id)
    where default_venue_id is not null;

-- ---------------------------------------------------------------------------
-- Players and player sharing
-- ---------------------------------------------------------------------------

create table public.players (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references auth.users(id) on delete cascade,
    first_name text not null check (char_length(btrim(first_name)) between 1 and 120),
    last_name text check (last_name is null or char_length(btrim(last_name)) between 1 and 160),
    birth_date date,
    preferred_foot text check (preferred_foot is null or preferred_foot in ('left', 'right', 'both')),
    primary_position text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.player_access (
    player_id uuid not null references public.players(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    permission text not null default 'use' check (permission = 'use'),
    created_at timestamptz not null default now(),
    primary key (player_id, user_id)
);

create table public.team_players (
    team_id uuid not null references public.teams(id) on delete cascade,
    player_id uuid not null references public.players(id) on delete cascade,
    default_number integer check (default_number is null or default_number > 0),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (team_id, player_id)
);

create trigger players_set_updated_at
before update on public.players
for each row execute function private.set_updated_at();

create trigger team_players_set_updated_at
before update on public.team_players
for each row execute function private.set_updated_at();

create index players_owner_user_id_idx on public.players (owner_user_id);
create index player_access_user_id_idx on public.player_access (user_id);
create index team_players_player_id_idx on public.team_players (player_id);

create or replace function private.owns_player(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.players p
        where p.id = target_player_id
          and p.owner_user_id = (select auth.uid())
    );
$$;

revoke all on function private.owns_player(uuid) from public;
grant execute on function private.owns_player(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.venues enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_access enable row level security;
alter table public.team_players enable row level security;

-- Profiles are private by default. Public author summaries can be exposed later
-- through a dedicated view/API without making the whole profile row public.
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
    id = (select auth.uid())
    or (select private.is_admin())
);

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
    id = (select auth.uid())
    or (select private.is_admin())
)
with check (
    id = (select auth.uid())
    or (select private.is_admin())
);

-- Official catalog data is public. Personal catalog data is owner/admin only.
create policy clubs_select_official
on public.clubs
for select
to anon, authenticated
using (scope = 'official');

create policy clubs_select_personal
on public.clubs
for select
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy clubs_insert
on public.clubs
for insert
to authenticated
with check (
    (scope = 'personal' and owner_user_id = (select auth.uid()))
    or (select private.is_admin())
);

create policy clubs_update
on public.clubs
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

create policy venues_select_official
on public.venues
for select
to anon, authenticated
using (scope = 'official');

create policy venues_select_personal
on public.venues
for select
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy venues_insert
on public.venues
for insert
to authenticated
with check (
    (scope = 'personal' and owner_user_id = (select auth.uid()))
    or (select private.is_admin())
);

create policy venues_update
on public.venues
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

create policy teams_select_official
on public.teams
for select
to anon, authenticated
using (scope = 'official');

create policy teams_select_personal
on public.teams
for select
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy teams_insert
on public.teams
for insert
to authenticated
with check (
    (
        scope = 'personal'
        and owner_user_id = (select auth.uid())
        and (
            club_id is null
            or exists (
                select 1
                from public.clubs c
                where c.id = teams.club_id
                  and (
                      c.scope = 'official'
                      or c.owner_user_id = (select auth.uid())
                  )
            )
        )
        and (
            default_venue_id is null
            or exists (
                select 1
                from public.venues v
                where v.id = teams.default_venue_id
                  and (
                      v.scope = 'official'
                      or v.owner_user_id = (select auth.uid())
                  )
            )
        )
    )
    or (select private.is_admin())
);

create policy teams_update
on public.teams
for update
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
)
with check (
    (
        scope = 'personal'
        and owner_user_id = (select auth.uid())
        and (
            club_id is null
            or exists (
                select 1
                from public.clubs c
                where c.id = teams.club_id
                  and (
                      c.scope = 'official'
                      or c.owner_user_id = (select auth.uid())
                  )
            )
        )
        and (
            default_venue_id is null
            or exists (
                select 1
                from public.venues v
                where v.id = teams.default_venue_id
                  and (
                      v.scope = 'official'
                      or v.owner_user_id = (select auth.uid())
                  )
            )
        )
    )
    or (select private.is_admin())
);

create policy players_select
on public.players
for select
to authenticated
using (
    owner_user_id = (select auth.uid())
    or exists (
        select 1
        from public.player_access pa
        where pa.player_id = players.id
          and pa.user_id = (select auth.uid())
    )
    or (select private.is_admin())
);

create policy players_insert
on public.players
for insert
to authenticated
with check (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy players_update
on public.players
for update
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
)
with check (
    owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy player_access_select
on public.player_access
for select
to authenticated
using (
    user_id = (select auth.uid())
    or (select private.owns_player(player_id))
    or (select private.is_admin())
);

create policy player_access_insert
on public.player_access
for insert
to authenticated
with check (
    (
        (select private.owns_player(player_id))
        and user_id <> (select auth.uid())
    )
    or (select private.is_admin())
);

create policy player_access_delete
on public.player_access
for delete
to authenticated
using (
    user_id = (select auth.uid())
    or (select private.owns_player(player_id))
    or (select private.is_admin())
);

create policy team_players_select
on public.team_players
for select
to authenticated
using (
    (
        exists (
            select 1
            from public.players p
            where p.id = team_players.player_id
        )
        and exists (
            select 1
            from public.teams t
            where t.id = team_players.team_id
        )
    )
    or (select private.is_admin())
);

create policy team_players_insert
on public.team_players
for insert
to authenticated
with check (
    (
        (select private.owns_player(player_id))
        and exists (
            select 1
            from public.teams t
            where t.id = team_players.team_id
              and (
                  t.scope = 'official'
                  or t.owner_user_id = (select auth.uid())
              )
        )
    )
    or (select private.is_admin())
);

create policy team_players_update
on public.team_players
for update
to authenticated
using (
    (select private.owns_player(player_id))
    or (select private.is_admin())
)
with check (
    (
        (select private.owns_player(player_id))
        and exists (
            select 1
            from public.teams t
            where t.id = team_players.team_id
              and (
                  t.scope = 'official'
                  or t.owner_user_id = (select auth.uid())
              )
        )
    )
    or (select private.is_admin())
);

-- ---------------------------------------------------------------------------
-- Explicit Data API privileges
-- ---------------------------------------------------------------------------

revoke all on table
    public.profiles,
    public.clubs,
    public.venues,
    public.teams,
    public.players,
    public.player_access,
    public.team_players
from anon, authenticated;

grant select on table public.clubs, public.venues, public.teams to anon;

grant select, insert, update on table
    public.profiles,
    public.clubs,
    public.venues,
    public.teams,
    public.players,
    public.team_players
to authenticated;

grant select, insert, delete on table public.player_access to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Logos and avatars are non-sensitive media. Objects are public by URL, but only
-- authenticated users can manage files under users/<auth.uid()>/..., while
-- admins can manage any object (including official/...).

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'media',
    'media',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp']
);

create policy media_select_own_or_admin
on storage.objects
for select
to authenticated
using (
    bucket_id = 'media'
    and (
        (
            (storage.foldername(name))[1] = 'users'
            and (storage.foldername(name))[2] = (select auth.uid())::text
        )
        or (select private.is_admin())
    )
);

create policy media_insert_own_or_admin
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'media'
    and (
        (
            (storage.foldername(name))[1] = 'users'
            and (storage.foldername(name))[2] = (select auth.uid())::text
        )
        or (select private.is_admin())
    )
);

create policy media_update_own_or_admin
on storage.objects
for update
to authenticated
using (
    bucket_id = 'media'
    and (
        (
            (storage.foldername(name))[1] = 'users'
            and (storage.foldername(name))[2] = (select auth.uid())::text
        )
        or (select private.is_admin())
    )
)
with check (
    bucket_id = 'media'
    and (
        (
            (storage.foldername(name))[1] = 'users'
            and (storage.foldername(name))[2] = (select auth.uid())::text
        )
        or (select private.is_admin())
    )
);

create policy media_delete_own_or_admin
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'media'
    and (
        (
            (storage.foldername(name))[1] = 'users'
            and (storage.foldername(name))[2] = (select auth.uid())::text
        )
        or (select private.is_admin())
    )
);

comment on schema private is 'Internal Gaeliza v2 authorization and trigger helpers; not exposed through the Data API.';
comment on table public.clubs is 'Clubs/organizations. Official rows are global; personal rows belong to one user.';
comment on table public.teams is 'Actual analysis units. A club may have multiple teams; club_id is optional.';
comment on table public.players is 'Persistent private player identities owned by a user.';
comment on table public.player_access is 'Explicit read/use sharing of a persistent player with another user.';
comment on table public.team_players is 'Persistent player-to-team membership with a team-specific default shirt number.';
