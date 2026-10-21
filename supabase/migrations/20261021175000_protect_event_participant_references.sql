-- Gaeliza v2 - prevent roster edits from silently erasing event attribution.
--
-- Deleting an analysis participant must not cascade-delete its event roles. The
-- FK is deferred so deleting the whole analysis still works: events (and their
-- event_participants) are removed by the analysis cascade in the same transaction.

alter table public.event_participants
    drop constraint event_participants_participant_same_analysis_fkey;

alter table public.event_participants
    add constraint event_participants_participant_same_analysis_fkey
    foreign key (analysis_participant_id, analysis_id)
    references public.analysis_participants (id, analysis_id)
    on delete no action
    deferrable initially deferred;

comment on constraint event_participants_participant_same_analysis_fkey
on public.event_participants is
'Prevents deleting an analysis participant while event roles still reference it; deferred to preserve whole-analysis cascade deletion.';
