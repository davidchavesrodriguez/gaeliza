-- Gaeliza v2 - cover analysis-domain foreign keys reported by Supabase advisor

create index analysis_participants_team_id_idx
    on public.analysis_participants (team_id);

create index video_sync_points_analysis_id_idx
    on public.video_sync_points (analysis_id);
