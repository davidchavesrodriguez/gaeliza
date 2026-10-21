-- Gaeliza v2 - cover composite foreign keys used to enforce phase/edition integrity.

-- The composite indexes also cover lookups by their leading phase id column, so
-- the previous single-column indexes become redundant.

drop index if exists public.competition_phases_parent_phase_id_idx;
create index competition_phases_parent_edition_idx
    on public.competition_phases (parent_phase_id, competition_edition_id)
    where parent_phase_id is not null;

drop index if exists public.matches_competition_phase_id_idx;
create index matches_phase_edition_idx
    on public.matches (competition_phase_id, competition_edition_id)
    where competition_phase_id is not null;
