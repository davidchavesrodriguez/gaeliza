-- Gaeliza v2 - canonical event, possession and capture-template model
--
-- Core rule: one physical occurrence is stored once. Specific events carry the
-- semantic truth; generic recovery/turnover metrics are derived when possible.

-- ---------------------------------------------------------------------------
-- Capture templates
-- ---------------------------------------------------------------------------

create table public.analysis_templates (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(btrim(name)) between 1 and 120),
    scope text not null check (scope in ('system', 'personal')),
    owner_user_id uuid references auth.users(id) on delete cascade,
    config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint analysis_templates_scope_owner_check check (
        (scope = 'system' and owner_user_id is null)
        or
        (scope = 'personal' and owner_user_id is not null)
    )
);

create unique index analysis_templates_system_name_uidx
    on public.analysis_templates (lower(name))
    where scope = 'system';

create index analysis_templates_owner_user_id_idx
    on public.analysis_templates (owner_user_id)
    where owner_user_id is not null;

create trigger analysis_templates_set_updated_at
before update on public.analysis_templates
for each row execute function private.set_updated_at();

alter table public.analyses
    add column template_id uuid references public.analysis_templates(id) on delete set null,
    add column template_config_snapshot jsonb not null default '{}'::jsonb
        check (jsonb_typeof(template_config_snapshot) = 'object');

create index analyses_template_id_idx
    on public.analyses (template_id)
    where template_id is not null;

-- ---------------------------------------------------------------------------
-- Possessions
-- ---------------------------------------------------------------------------

create table public.possessions (
    id uuid primary key default gen_random_uuid(),
    analysis_id uuid not null references public.analyses(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete restrict,
    period_id uuid not null,
    start_second integer not null check (start_second >= 0),
    end_second integer check (end_second is null or end_second >= start_second),
    start_reason text check (
        start_reason is null
        or start_reason in (
            'kickout', 'turnover', 'recovery', 'interception', 'throw_in',
            'free', 'sideline', 'restart', 'period_start', 'other'
        )
    ),
    end_reason text check (
        end_reason is null
        or end_reason in (
            'goal', 'point', 'miss', 'turnover', 'foul', 'period_end', 'other'
        )
    ),
    source text not null default 'inferred' check (source in ('inferred', 'manual')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, analysis_id, team_id),
    constraint possessions_period_same_analysis_fkey
        foreign key (period_id, analysis_id)
        references public.analysis_periods (id, analysis_id)
        on delete restrict,
    constraint possessions_end_reason_requires_end_check check (
        end_reason is null or end_second is not null
    )
);

create unique index possessions_one_open_per_analysis_uidx
    on public.possessions (analysis_id)
    where end_second is null;

create index possessions_analysis_period_start_idx
    on public.possessions (analysis_id, period_id, start_second);

create index possessions_team_id_idx on public.possessions (team_id);
create index possessions_period_analysis_idx on public.possessions (period_id, analysis_id);

create trigger possessions_set_updated_at
before update on public.possessions
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Base events
-- ---------------------------------------------------------------------------

create table public.events (
    id uuid primary key default gen_random_uuid(),
    analysis_id uuid not null references public.analyses(id) on delete cascade,
    possession_id uuid,
    team_id uuid not null references public.teams(id) on delete restrict,
    period_id uuid not null,
    event_type text not null check (
        event_type in (
            'shot', 'pass', 'recovery', 'turnover', 'duel', 'dribble',
            'foul', 'card', 'kickout', 'restart', 'block',
            'substitution', 'goalkeeper_change'
        )
    ),
    second_in_period integer not null check (second_in_period >= 0),
    sort_order integer not null default 0 check (sort_order >= 0),
    x numeric(5,2) check (x is null or (x >= 0 and x <= 100)),
    y numeric(5,2) check (y is null or (y >= 0 and y <= 100)),
    notes text,
    created_by uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, analysis_id),
    constraint events_period_same_analysis_fkey
        foreign key (period_id, analysis_id)
        references public.analysis_periods (id, analysis_id)
        on delete restrict,
    constraint events_possession_same_analysis_team_fkey
        foreign key (possession_id, analysis_id, team_id)
        references public.possessions (id, analysis_id, team_id)
        on delete set null (possession_id)
);

create index events_analysis_timeline_idx
    on public.events (analysis_id, period_id, second_in_period, sort_order, created_at);

create index events_analysis_type_idx
    on public.events (analysis_id, event_type);

create index events_team_id_idx on public.events (team_id);
create index events_period_analysis_idx on public.events (period_id, analysis_id);
create index events_possession_analysis_team_idx
    on public.events (possession_id, analysis_id, team_id)
    where possession_id is not null;
create index events_created_by_idx on public.events (created_by);

create trigger events_set_updated_at
before update on public.events
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Typed event details
-- Core analytics live in typed columns, not JSONB.
-- ---------------------------------------------------------------------------

create table public.shot_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    result text check (result is null or result in ('goal', 'point', 'wide', 'saved', 'blocked', 'post')),
    technique text check (technique is null or technique in ('foot', 'hand')),
    situation text check (situation is null or situation in ('open_play', 'free', 'forty_five', 'penalty'))
);

create table public.pass_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    result text check (result is null or result in ('completed', 'incomplete', 'intercepted')),
    technique text check (technique is null or technique in ('hand', 'foot')),
    end_x numeric(5,2) check (end_x is null or (end_x >= 0 and end_x <= 100)),
    end_y numeric(5,2) check (end_y is null or (end_y >= 0 and end_y <= 100))
);

create table public.recovery_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    method text check (
        method is null
        or method in ('interception', 'tackle', 'loose_ball', 'rebound', 'kickout', 'other')
    )
);

create table public.turnover_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    cause text check (
        cause is null
        or cause in (
            'bad_pass', 'bad_control', 'steps', 'out_of_play',
            'offensive_foul', 'dispossessed', 'other'
        )
    )
);

create table public.duel_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    duel_type text check (duel_type is null or duel_type in ('aerial', 'ground', 'other'))
);

create table public.dribble_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    result text check (result is null or result in ('successful', 'failed'))
);

create table public.foul_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    cause text check (
        cause is null
        or cause in ('holding', 'striking', 'obstruction', 'pickup', 'steps', 'push', 'trip', 'other')
    ),
    outcome text check (
        outcome is null
        or outcome in ('free', 'forty_five', 'penalty', 'advantage', 'none')
    )
);

create table public.card_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    card_type text check (card_type is null or card_type in ('yellow', 'black', 'red')),
    related_foul_event_id uuid references public.events(id) on delete set null
);

create index card_events_related_foul_event_id_idx
    on public.card_events (related_foul_event_id)
    where related_foul_event_id is not null;

create table public.kickout_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    length text check (length is null or length in ('short', 'long')),
    result text check (
        result is null
        or result in ('retained', 'contested_won', 'contested_lost', 'directly_lost')
    ),
    end_x numeric(5,2) check (end_x is null or (end_x >= 0 and end_x <= 100)),
    end_y numeric(5,2) check (end_y is null or (end_y >= 0 and end_y <= 100))
);

create table public.restart_events (
    event_id uuid primary key references public.events(id) on delete cascade,
    restart_type text check (
        restart_type is null
        or restart_type in ('free', 'sideline', 'throw_in', 'forty_five', 'penalty', 'other')
    )
);

-- ---------------------------------------------------------------------------
-- Event participants
-- ---------------------------------------------------------------------------

create table public.event_participants (
    event_id uuid not null,
    analysis_id uuid not null,
    analysis_participant_id uuid not null,
    role text not null check (
        role in (
            'shooter', 'assister', 'goalkeeper',
            'passer', 'receiver', 'intended_receiver', 'interceptor',
            'recoverer', 'turnover_player',
            'duel_winner', 'duel_loser',
            'dribbler', 'defender',
            'offender', 'fouled', 'card_recipient',
            'kicker', 'target', 'kickout_receiver', 'opponent',
            'restart_taker', 'blocker', 'blocked_player',
            'player_out', 'player_in',
            'goalkeeper_out', 'goalkeeper_in'
        )
    ),
    created_at timestamptz not null default now(),
    primary key (event_id, analysis_participant_id, role),
    constraint event_participants_event_same_analysis_fkey
        foreign key (event_id, analysis_id)
        references public.events (id, analysis_id)
        on delete cascade,
    constraint event_participants_participant_same_analysis_fkey
        foreign key (analysis_participant_id, analysis_id)
        references public.analysis_participants (id, analysis_id)
        on delete cascade
);

create index event_participants_analysis_id_idx on public.event_participants (analysis_id);
create index event_participants_participant_analysis_idx
    on public.event_participants (analysis_participant_id, analysis_id);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

create or replace function private.validate_analysis_fact_team()
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
        raise exception 'team % is not part of analysis match', new.team_id
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_analysis_fact_team() from public, anon, authenticated;

create trigger possessions_validate_team
before insert or update of analysis_id, team_id on public.possessions
for each row execute function private.validate_analysis_fact_team();

create trigger events_validate_team
before insert or update of analysis_id, team_id on public.events
for each row execute function private.validate_analysis_fact_team();

create or replace function private.validate_event_detail_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_expected_type text;
    v_actual_type text;
begin
    v_expected_type := case tg_table_name
        when 'shot_events' then 'shot'
        when 'pass_events' then 'pass'
        when 'recovery_events' then 'recovery'
        when 'turnover_events' then 'turnover'
        when 'duel_events' then 'duel'
        when 'dribble_events' then 'dribble'
        when 'foul_events' then 'foul'
        when 'card_events' then 'card'
        when 'kickout_events' then 'kickout'
        when 'restart_events' then 'restart'
        else null
    end;

    if v_expected_type is null then
        raise exception 'unsupported typed event table %', tg_table_name
            using errcode = '23514';
    end if;

    select e.event_type
      into v_actual_type
      from public.events e
     where e.id = new.event_id;

    if not found then
        raise exception 'event % does not exist', new.event_id
            using errcode = '23503';
    end if;

    if v_actual_type <> v_expected_type then
        raise exception 'event % has type %, expected % for %',
            new.event_id, v_actual_type, v_expected_type, tg_table_name
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_event_detail_type() from public, anon, authenticated;

create trigger shot_events_validate_type before insert or update of event_id on public.shot_events
for each row execute function private.validate_event_detail_type();
create trigger pass_events_validate_type before insert or update of event_id on public.pass_events
for each row execute function private.validate_event_detail_type();
create trigger recovery_events_validate_type before insert or update of event_id on public.recovery_events
for each row execute function private.validate_event_detail_type();
create trigger turnover_events_validate_type before insert or update of event_id on public.turnover_events
for each row execute function private.validate_event_detail_type();
create trigger duel_events_validate_type before insert or update of event_id on public.duel_events
for each row execute function private.validate_event_detail_type();
create trigger dribble_events_validate_type before insert or update of event_id on public.dribble_events
for each row execute function private.validate_event_detail_type();
create trigger foul_events_validate_type before insert or update of event_id on public.foul_events
for each row execute function private.validate_event_detail_type();
create trigger card_events_validate_type before insert or update of event_id on public.card_events
for each row execute function private.validate_event_detail_type();
create trigger kickout_events_validate_type before insert or update of event_id on public.kickout_events
for each row execute function private.validate_event_detail_type();
create trigger restart_events_validate_type before insert or update of event_id on public.restart_events
for each row execute function private.validate_event_detail_type();

create or replace function private.validate_related_foul_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_card_analysis_id uuid;
    v_foul_analysis_id uuid;
    v_foul_type text;
begin
    if new.related_foul_event_id is null then
        return new;
    end if;

    select e.analysis_id
      into v_card_analysis_id
      from public.events e
     where e.id = new.event_id;

    select e.analysis_id, e.event_type
      into v_foul_analysis_id, v_foul_type
      from public.events e
     where e.id = new.related_foul_event_id;

    if v_foul_type is distinct from 'foul' then
        raise exception 'related event % is not a foul event', new.related_foul_event_id
            using errcode = '23514';
    end if;

    if v_card_analysis_id is distinct from v_foul_analysis_id then
        raise exception 'card and related foul must belong to the same analysis'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_related_foul_event() from public, anon, authenticated;

create trigger card_events_validate_related_foul
before insert or update of event_id, related_foul_event_id on public.card_events
for each row execute function private.validate_related_foul_event();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.analysis_templates enable row level security;
alter table public.possessions enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.shot_events enable row level security;
alter table public.pass_events enable row level security;
alter table public.recovery_events enable row level security;
alter table public.turnover_events enable row level security;
alter table public.duel_events enable row level security;
alter table public.dribble_events enable row level security;
alter table public.foul_events enable row level security;
alter table public.card_events enable row level security;
alter table public.kickout_events enable row level security;
alter table public.restart_events enable row level security;

create policy analysis_templates_select
on public.analysis_templates
for select
to authenticated
using (
    scope = 'system'
    or owner_user_id = (select auth.uid())
    or (select private.is_admin())
);

create policy analysis_templates_insert
on public.analysis_templates
for insert
to authenticated
with check (
    (scope = 'personal' and owner_user_id = (select auth.uid()))
    or (scope = 'system' and (select private.is_admin()))
);

create policy analysis_templates_update
on public.analysis_templates
for update
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (scope = 'system' and (select private.is_admin()))
)
with check (
    (scope = 'personal' and owner_user_id = (select auth.uid()))
    or (scope = 'system' and (select private.is_admin()))
);

create policy analysis_templates_delete
on public.analysis_templates
for delete
to authenticated
using (
    owner_user_id = (select auth.uid())
    or (scope = 'system' and (select private.is_admin()))
);

create policy possessions_select
on public.possessions
for select
to anon, authenticated
using (
    exists (
        select 1 from public.analyses a
        where a.id = possessions.analysis_id
    )
);

create policy possessions_insert_owner
on public.possessions
for insert
to authenticated
with check (
    exists (
        select 1 from public.analyses a
        where a.id = possessions.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy possessions_update_owner
on public.possessions
for update
to authenticated
using (
    exists (
        select 1 from public.analyses a
        where a.id = possessions.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1 from public.analyses a
        where a.id = possessions.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy possessions_delete_owner
on public.possessions
for delete
to authenticated
using (
    exists (
        select 1 from public.analyses a
        where a.id = possessions.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy events_select
on public.events
for select
to anon, authenticated
using (
    exists (
        select 1 from public.analyses a
        where a.id = events.analysis_id
    )
);

create policy events_insert_owner
on public.events
for insert
to authenticated
with check (
    created_by = (select auth.uid())
    and exists (
        select 1 from public.analyses a
        where a.id = events.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy events_update_owner
on public.events
for update
to authenticated
using (
    exists (
        select 1 from public.analyses a
        where a.id = events.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
)
with check (
    created_by = (select auth.uid())
    and exists (
        select 1 from public.analyses a
        where a.id = events.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy events_delete_owner
on public.events
for delete
to authenticated
using (
    exists (
        select 1 from public.analyses a
        where a.id = events.analysis_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy event_participants_select
on public.event_participants
for select
to anon, authenticated
using (
    exists (
        select 1 from public.events e
        where e.id = event_participants.event_id
    )
);

create policy event_participants_insert_owner
on public.event_participants
for insert
to authenticated
with check (
    exists (
        select 1
        from public.events e
        join public.analyses a on a.id = e.analysis_id
        where e.id = event_participants.event_id
          and a.owner_user_id = (select auth.uid())
    )
);

create policy event_participants_delete_owner
on public.event_participants
for delete
to authenticated
using (
    exists (
        select 1
        from public.events e
        join public.analyses a on a.id = e.analysis_id
        where e.id = event_participants.event_id
          and a.owner_user_id = (select auth.uid())
    )
);

-- Typed detail tables inherit read/write access from their base event.
create policy shot_events_select on public.shot_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = shot_events.event_id));
create policy pass_events_select on public.pass_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = pass_events.event_id));
create policy recovery_events_select on public.recovery_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = recovery_events.event_id));
create policy turnover_events_select on public.turnover_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = turnover_events.event_id));
create policy duel_events_select on public.duel_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = duel_events.event_id));
create policy dribble_events_select on public.dribble_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = dribble_events.event_id));
create policy foul_events_select on public.foul_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = foul_events.event_id));
create policy card_events_select on public.card_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = card_events.event_id));
create policy kickout_events_select on public.kickout_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = kickout_events.event_id));
create policy restart_events_select on public.restart_events for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = restart_events.event_id));

create policy shot_events_write on public.shot_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=shot_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=shot_events.event_id and a.owner_user_id=(select auth.uid())));
create policy pass_events_write on public.pass_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=pass_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=pass_events.event_id and a.owner_user_id=(select auth.uid())));
create policy recovery_events_write on public.recovery_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=recovery_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=recovery_events.event_id and a.owner_user_id=(select auth.uid())));
create policy turnover_events_write on public.turnover_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=turnover_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=turnover_events.event_id and a.owner_user_id=(select auth.uid())));
create policy duel_events_write on public.duel_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=duel_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=duel_events.event_id and a.owner_user_id=(select auth.uid())));
create policy dribble_events_write on public.dribble_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=dribble_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=dribble_events.event_id and a.owner_user_id=(select auth.uid())));
create policy foul_events_write on public.foul_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=foul_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=foul_events.event_id and a.owner_user_id=(select auth.uid())));
create policy card_events_write on public.card_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=card_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=card_events.event_id and a.owner_user_id=(select auth.uid())));
create policy kickout_events_write on public.kickout_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=kickout_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=kickout_events.event_id and a.owner_user_id=(select auth.uid())));
create policy restart_events_write on public.restart_events for all to authenticated
using (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=restart_events.event_id and a.owner_user_id=(select auth.uid())))
with check (exists (select 1 from public.events e join public.analyses a on a.id=e.analysis_id where e.id=restart_events.event_id and a.owner_user_id=(select auth.uid())));

-- ---------------------------------------------------------------------------
-- Explicit Data API privileges
-- ---------------------------------------------------------------------------

revoke all on table
    public.analysis_templates,
    public.possessions,
    public.events,
    public.event_participants,
    public.shot_events,
    public.pass_events,
    public.recovery_events,
    public.turnover_events,
    public.duel_events,
    public.dribble_events,
    public.foul_events,
    public.card_events,
    public.kickout_events,
    public.restart_events
from anon, authenticated;

grant select on table
    public.possessions,
    public.events,
    public.event_participants,
    public.shot_events,
    public.pass_events,
    public.recovery_events,
    public.turnover_events,
    public.duel_events,
    public.dribble_events,
    public.foul_events,
    public.card_events,
    public.kickout_events,
    public.restart_events
to anon;

grant select, insert, update, delete on table
    public.analysis_templates,
    public.possessions,
    public.events,
    public.event_participants,
    public.shot_events,
    public.pass_events,
    public.recovery_events,
    public.turnover_events,
    public.duel_events,
    public.dribble_events,
    public.foul_events,
    public.card_events,
    public.kickout_events,
    public.restart_events
to authenticated;

comment on table public.possessions is
'Possessions are inferred from canonical events, then may be manually corrected. Inference must never overwrite rows whose source is manual.';
comment on table public.events is
'One row per physical occurrence. Do not duplicate a specific pass/shot outcome as generic recovery/turnover/save/block events.';
comment on table public.event_participants is
'Roles point to analysis_participants snapshots, not directly to persistent players.';
