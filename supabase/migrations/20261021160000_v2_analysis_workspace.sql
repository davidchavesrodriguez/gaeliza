-- Gaeliza v2 - analysis workspace: analyses, periods, videos, sync and participants

-- ---------------------------------------------------------------------------
-- Analyses
-- ---------------------------------------------------------------------------

create table public.analyses (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches(id) on delete restrict,
    owner_user_id uuid not null references auth.users(id) on delete cascade,
    title text check (title is null or char_length(btrim(title)) between 1 and 200),
    notes text,
    mode text not null default 'post_match' check (mode in ('post_match', 'live')),
    status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
    visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index analyses_match_id_idx on public.analyses (match_id);
create index analyses_owner_created_at_idx on public.analyses (owner_user_id, created_at desc);
create index analyses_public_created_at_idx on public.analyses (created_at desc)
    where visibility = 'public';

create trigger analyses_set_updated_at
before update on public.analyses
for each row execute function private.set_updated_at();

create or replace function private.set_analysis_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.status = 'completed' and old.status is distinct from 'completed' then
        new.completed_at = coalesce(new.completed_at, now());
    elsif new.status <> 'completed' then
        new.completed_at = null;
    end if;

    return new;
end;
$$;

revoke all on function private.set_analysis_completed_at() from public, anon, authenticated;

create trigger analyses_set_completed_at
before update on public.analyses
for each row execute function private.set_analysis_completed_at();

comment on column public.analyses.visibility is
'Unlisted is owner-only at the table RLS layer until a dedicated share-token RPC/view is implemented; public is anonymously readable.';

-- ---------------------------------------------------------------------------
-- Analysis periods
-- ---------------------------------------------------------------------------

create table public.analysis_periods (
    id uuid primary key default gen_random_uuid(),
    analysis_id uuid not null references public.analyses(id) on delete cascade,
    number integer not null check (number > 0),
    name text check (name is null or char_length(btrim(name)) between 1 and 120),
    expected_duration_seconds integer not null default 1800 check (expected_duration_seconds > 0),
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (analysis_id, number),
    unique (analysis_id, sort_order),
    unique (id, analysis_id)
);

create index analysis_periods_analysis_sort_idx
    on public.analysis_periods (analysis_id, sort_order);

create trigger analysis_periods_set_updated_at
before update on public.analysis_periods
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Analysis videos and synchronization points
-- ---------------------------------------------------------------------------

create table public.analysis_videos (
    id uuid primary key default gen_random_uuid(),
    analysis_id uuid not null references public.analyses(id) on delete cascade,
    url text not null check (char_length(btrim(url)) between 1 and 2048),
    provider text check (provider is null or char_length(btrim(provider)) between 1 and 50),
    title text check (title is null or char_length(btrim(title)) between 1 and 200),
    duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds >= 0),
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (analysis_id, sort_order),
    unique (id, analysis_id)
);

create index analysis_videos_analysis_sort_idx
    on public.analysis_videos (analysis_id, sort_order);

create trigger analysis_videos_set_updated_at
before update on public.analysis_videos
for each row execute function private.set_updated_at();

create table public.video_sync_points (
    id uuid primary key default gen_random_uuid(),
    analysis_id uuid not null references public.analyses(id) on delete cascade,
    analysis_video_id uuid not null,
    analysis_period_id uuid not null,
    video_second numeric(12,3) not null check (video_second >= 0),
    second_in_period integer not null check (second_in_period >= 0),
    created_at timestamptz not null default now(),
    constraint video_sync_points_video_same_analysis_fkey
        foreign key (analysis_video_id, analysis_id)
        references public.analysis_videos (id, analysis_id)
        on delete cascade,
    constraint video_sync_points_period_same_analysis_fkey
        foreign key (analysis_period_id, analysis_id)
        references public.analysis_periods (id, analysis_id)
        on delete cascade,
    unique (analysis_video_id, video_second)
);

create index video_sync_points_video_analysis_idx
    on public.video_sync_points (analysis_video_id, analysis_id);

create index video_sync_points_period_analysis_idx
    on public.video_sync_points (analysis_period_id, analysis_id);

create index video_sync_points_period_time_idx
    on public.video_sync_points (analysis_period_id, second_in_period);

-- ---------------------------------------------------------------------------
-- Analysis participants / roster snapshots
-- ---------------------------------------------------------------------------

create table public.analysis_participants (
    id uuid primary key default gen_random_uuid(),
    analysis_id uuid not null references public.analyses(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete restrict,
    player_id uuid references public.players(id) on delete set null,
    display_name_snapshot text not null check (char_length(btrim(display_name_snapshot)) between 1 and 200),
    number integer check (number is null or number > 0),
    starter boolean,
    initial_goalkeeper boolean,
    position text check (position is null or char_length(btrim(position)) between 1 and 100),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, analysis_id)
);

create unique index analysis_participants_player_uidx
    on public.analysis_participants (analysis_id, player_id)
    where player_id is not null;

create unique index analysis_participants_initial_goalkeeper_uidx
    on public.analysis_participants (analysis_id, team_id)
    where initial_goalkeeper is true;

create index analysis_participants_analysis_team_idx
    on public.analysis_participants (analysis_id, team_id);

create index analysis_participants_player_id_idx
    on public.analysis_participants (player_id)
    where player_id is not null;

create trigger analysis_participants_set_updated_at
before update on public.analysis_participants
for each row execute function private.set_updated_at();

create or replace function private.validate_analysis_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_home_team_id uuid;
    v_away_team_id uuid;
begin
    select m.home_team_id, m.away_team_id
      into v_home_team_id, v_away_team_id
      from public.analyses a
      join public.matches m on m.id = a.match_id
     where a.id = new.analysis_id;

    if not found then
        raise exception 'analysis % does not exist', new.analysis_id
            using errcode = '23503';
    end if;

    if new.team_id <> v_home_team_id and new.team_id <> v_away_team_id then
        raise exception 'participant team % is not part of analysis match', new.team_id
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_analysis_participant() from public, anon, authenticated;

create trigger analysis_participants_validate_team
before insert or update of analysis_id, team_id on public.analysis_participants
for each row execute function private.validate_analysis_participant();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.analyses enable row level security;
alter table public.analysis_periods enable row level security;
alter table public.analysis_videos enable row level security;
alter table public.video_sync_points enable row level security;
alter table public.analysis_participants enable row level security;

-- Analyses: owners and admins can read private/unlisted; anonymous readers only
-- see public analyses. Unlisted sharing will use a dedicated tokenized endpoint.
create policy analyses_select_anon_public
on public.analyses
for select
to anon
using (visibility = 'public');

create policy analyses_select_authenticated
on public.analyses
for select
to authenticated
using (
    visibility = 'public'
    or owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy analyses_insert_owner
on public.analyses
for insert
to authenticated
with check (
    owner_user_id = (select auth.uid())
    and exists (
        select 1
        from public.matches m
        where m.id = analyses.match_id
    )
);

create policy analyses_update_owner
on public.analyses
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (
    owner_user_id = (select auth.uid())
    and exists (
        select 1
        from public.matches m
        where m.id = analyses.match_id
    )
);

create policy analyses_delete_owner
on public.analyses
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

-- Child rows inherit analysis readability.
create policy analysis_periods_select
on public.analysis_periods
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_periods.analysis_id
    )
);

create policy analysis_videos_select
on public.analysis_videos
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_videos.analysis_id
    )
);

create policy video_sync_points_select
on public.video_sync_points
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = video_sync_points.analysis_id
    )
);

create policy analysis_participants_select
on public.analysis_participants
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_participants.analysis_id
    )
);

-- Child writes are owner-only. Admin support access remains read-only here.
create policy analysis_periods_insert_owner
on public.analysis_periods
for insert
to authenticated
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_periods.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy analysis_periods_update_owner
on public.analysis_periods
for update
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_periods.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_periods.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy analysis_periods_delete_owner
on public.analysis_periods
for delete
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_periods.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy analysis_videos_insert_owner
on public.analysis_videos
for insert
to authenticated
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_videos.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy analysis_videos_update_owner
on public.analysis_videos
for update
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_videos.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_videos.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy analysis_videos_delete_owner
on public.analysis_videos
for delete
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_videos.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy video_sync_points_insert_owner
on public.video_sync_points
for insert
to authenticated
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = video_sync_points.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy video_sync_points_update_owner
on public.video_sync_points
for update
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = video_sync_points.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = video_sync_points.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy video_sync_points_delete_owner
on public.video_sync_points
for delete
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = video_sync_points.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy analysis_participants_insert_owner
on public.analysis_participants
for insert
to authenticated
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_participants.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
    and (
        player_id is null
        or exists (
            select 1
            from public.players p
            where p.id = analysis_participants.player_id
        )
    )
);

create policy analysis_participants_update_owner
on public.analysis_participants
for update
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_participants.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_participants.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
    and (
        player_id is null
        or exists (
            select 1
            from public.players p
            where p.id = analysis_participants.player_id
        )
    )
);

create policy analysis_participants_delete_owner
on public.analysis_participants
for delete
to authenticated
using (
    exists (
        select 1
        from public.analyses a
        where a.id = analysis_participants.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

-- ---------------------------------------------------------------------------
-- Atomic analysis creation
-- ---------------------------------------------------------------------------

create or replace function public.create_analysis(
    p_match_id uuid,
    p_title text default null,
    p_mode text default 'post_match'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_analysis_id uuid;
begin
    if (select auth.uid()) is null then
        raise exception 'authentication required' using errcode = '42501';
    end if;

    insert into public.analyses (
        match_id,
        owner_user_id,
        title,
        mode,
        status,
        visibility
    )
    values (
        p_match_id,
        (select auth.uid()),
        p_title,
        p_mode,
        'draft',
        'private'
    )
    returning id into v_analysis_id;

    insert into public.analysis_periods (
        analysis_id,
        number,
        expected_duration_seconds,
        sort_order
    )
    values
        (v_analysis_id, 1, 1800, 0),
        (v_analysis_id, 2, 1800, 1);

    return v_analysis_id;
end;
$$;

revoke all on function public.create_analysis(uuid, text, text) from public, anon;
grant execute on function public.create_analysis(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Explicit Data API privileges
-- ---------------------------------------------------------------------------

revoke all on table
    public.analyses,
    public.analysis_periods,
    public.analysis_videos,
    public.video_sync_points,
    public.analysis_participants
from anon, authenticated;

grant select on table
    public.analyses,
    public.analysis_periods,
    public.analysis_videos,
    public.video_sync_points,
    public.analysis_participants
to anon;

grant select, insert, update, delete on table
    public.analyses,
    public.analysis_periods,
    public.analysis_videos,
    public.video_sync_points,
    public.analysis_participants
to authenticated;

comment on table public.analyses is 'One user-owned analysis of a match. Multiple independent analyses may reference the same match.';
comment on table public.analysis_periods is 'Configurable match periods for one analysis. Defaults are created as two 30-minute periods.';
comment on table public.analysis_videos is 'One or more external video sources attached to an analysis.';
comment on table public.video_sync_points is 'Maps a video timestamp to an analysis period timestamp; multiple points allow drift correction.';
comment on table public.analysis_participants is 'Per-analysis roster snapshot. player_id is optional so temporary rival participants can later be linked without losing event history.';
