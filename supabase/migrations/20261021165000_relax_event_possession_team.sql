-- Gaeliza v2 - an event may describe the opponent during a possession.
--
-- Example: Team A has possession and Team B commits a foul. The event belongs
-- to Team B, while possession_id still points to Team A's possession. Therefore
-- possession linkage must enforce same analysis, not same team.

alter table public.possessions
    add constraint possessions_id_analysis_unique unique (id, analysis_id);

alter table public.events
    drop constraint events_possession_same_analysis_team_fkey;

alter table public.events
    add constraint events_possession_same_analysis_fkey
        foreign key (possession_id, analysis_id)
        references public.possessions (id, analysis_id)
        on delete set null (possession_id);

drop index if exists public.events_possession_analysis_team_idx;

create index events_possession_analysis_idx
    on public.events (possession_id, analysis_id)
    where possession_id is not null;

comment on column public.events.team_id is
'Team whose action the event primarily describes/credits. It may differ from the team owning possession_id (for example an opponent foul or defensive block).';
