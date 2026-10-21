-- Gaeliza v2 - consolidate catalog SELECT policies by Postgres role.
--
-- The baseline used separate "official" and "personal" permissive policies for
-- authenticated users. They are correct, but Supabase's performance advisor
-- flags multiple permissive policies for the same role/action. Keep anon and
-- authenticated access separate so anon never needs permission to call the
-- private admin helper.

-- Clubs

drop policy if exists clubs_select_official on public.clubs;
drop policy if exists clubs_select_personal on public.clubs;

create policy clubs_select_anon_official
on public.clubs
for select
to anon
using (scope = 'official');

create policy clubs_select_authenticated
on public.clubs
for select
to authenticated
using (
    scope = 'official'
    or owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

-- Venues

drop policy if exists venues_select_official on public.venues;
drop policy if exists venues_select_personal on public.venues;

create policy venues_select_anon_official
on public.venues
for select
to anon
using (scope = 'official');

create policy venues_select_authenticated
on public.venues
for select
to authenticated
using (
    scope = 'official'
    or owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

-- Teams

drop policy if exists teams_select_official on public.teams;
drop policy if exists teams_select_personal on public.teams;

create policy teams_select_anon_official
on public.teams
for select
to anon
using (scope = 'official');

create policy teams_select_authenticated
on public.teams
for select
to authenticated
using (
    scope = 'official'
    or owner_user_id = (select auth.uid())
    or (select private.is_admin())
);
