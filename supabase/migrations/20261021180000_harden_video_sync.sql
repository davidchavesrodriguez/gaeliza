-- Gaeliza v2 - harden video URLs and synchronization bounds.

alter table public.analysis_videos
    add constraint analysis_videos_http_url_check
    check (btrim(url) ~* '^https?://[^[:space:]]+$');

create or replace function private.validate_video_sync_point_bounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_video_duration numeric(12,3);
    v_period_duration integer;
begin
    select v.duration_seconds
      into v_video_duration
      from public.analysis_videos v
     where v.id = new.analysis_video_id
       and v.analysis_id = new.analysis_id;

    if not found then
        raise exception 'video % does not exist in analysis %', new.analysis_video_id, new.analysis_id
            using errcode = '23503';
    end if;

    select p.expected_duration_seconds
      into v_period_duration
      from public.analysis_periods p
     where p.id = new.analysis_period_id
       and p.analysis_id = new.analysis_id;

    if not found then
        raise exception 'period % does not exist in analysis %', new.analysis_period_id, new.analysis_id
            using errcode = '23503';
    end if;

    if v_video_duration is not null and new.video_second > v_video_duration then
        raise exception 'video_second % exceeds video duration %', new.video_second, v_video_duration
            using errcode = '23514';
    end if;

    if new.second_in_period > v_period_duration then
        raise exception 'second_in_period % exceeds expected period duration %', new.second_in_period, v_period_duration
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_video_sync_point_bounds() from public, anon, authenticated;

create trigger video_sync_points_validate_bounds
before insert or update of analysis_id, analysis_video_id, analysis_period_id, video_second, second_in_period
on public.video_sync_points
for each row execute function private.validate_video_sync_point_bounds();

create or replace function private.prevent_video_duration_below_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.duration_seconds is not null and exists (
        select 1
        from public.video_sync_points sp
        where sp.analysis_video_id = old.id
          and sp.video_second > new.duration_seconds
    ) then
        raise exception 'video duration cannot be shorter than an existing synchronization point'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.prevent_video_duration_below_sync() from public, anon, authenticated;

create trigger analysis_videos_validate_duration
before update of duration_seconds on public.analysis_videos
for each row execute function private.prevent_video_duration_below_sync();

create or replace function private.prevent_period_duration_below_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if exists (
        select 1
        from public.video_sync_points sp
        where sp.analysis_period_id = old.id
          and sp.second_in_period > new.expected_duration_seconds
    ) then
        raise exception 'period duration cannot be shorter than an existing synchronization point'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.prevent_period_duration_below_sync() from public, anon, authenticated;

create trigger analysis_periods_validate_duration
before update of expected_duration_seconds on public.analysis_periods
for each row execute function private.prevent_period_duration_below_sync();

comment on constraint analysis_videos_http_url_check on public.analysis_videos is
'Gaeliza v2 only accepts http/https external video URLs in v1; browser-rendered javascript/data URLs are rejected at the database boundary.';
