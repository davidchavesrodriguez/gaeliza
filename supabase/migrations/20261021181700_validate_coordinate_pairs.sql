-- Gaeliza v2 - spatial coordinates represent points, never half-points.

alter table public.events
    add constraint events_coordinate_pair_check
    check ((x is null) = (y is null));

alter table public.pass_events
    add constraint pass_events_end_coordinate_pair_check
    check ((end_x is null) = (end_y is null));

alter table public.kickout_events
    add constraint kickout_events_end_coordinate_pair_check
    check ((end_x is null) = (end_y is null));
