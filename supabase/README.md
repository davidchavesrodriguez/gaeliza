# Supabase — Gaeliza v2

This directory is the source of truth for the Gaeliza v2 database.

## Safety

The first v2 migration is a **clean-database baseline**. It intentionally does not
drop or mutate the legacy Gaeliza schema. Do **not** run it against the current
legacy project yet: tables such as `profiles`, `teams`, and `players` already
exist there, so the migration is expected to fail and roll back.

The legacy cutover will be an explicit step once the complete v2 schema and the
new frontend are ready.

Never run `supabase db reset --linked` against the current hosted project unless
we have explicitly decided to destroy and rebuild it.

## Local workflow

With the Supabase CLI and a compatible local runtime installed:

```bash
supabase start
supabase db reset --local
```

For future imperative schema changes:

```bash
supabase migration new <change-name>
supabase db reset --local
```

Before deploying to a linked remote project, always preview pending migrations:

```bash
supabase db push --dry-run
```

## v2 core model

The initial baseline contains:

- `profiles`
- `clubs`
- `venues`
- `teams`
- `players`
- `team_players`
- `player_access`
- internal admin/authorization helpers
- the public `media` Storage bucket and upload policies

Master data is soft-disabled with `active` instead of being routinely deleted.
Official catalog rows are globally readable. Personal catalog rows are private to
their owner. Players are private but can be explicitly shared with `use`
permission; sharing a player does not grant access to another user's analyses.

## Storage paths

The `media` bucket is for non-sensitive images only.

- `official/...` — managed by admins.
- `users/<user-id>/...` — managed by that authenticated user.

Use random object names from the application rather than user-provided filenames.
The bucket is public by URL because club/team shields and avatars are not treated
as secrets; write/list permissions remain protected by RLS.

## Admin bootstrap

Admin membership lives in `private.user_roles`, not user-editable Auth metadata.
After a permanent administrator account exists, bootstrap it from a trusted SQL
session by inserting its Auth user id with role `admin`.

Do not expose direct writes to `private.user_roles` through the frontend.
