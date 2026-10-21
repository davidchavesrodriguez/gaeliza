# Gaeliza v2 analytics read model

Gaeliza keeps canonical match facts in the write model and derives statistics from them. Aggregated statistics are not persisted as a second source of truth unless future production measurements justify caching or materialization.

## Spatial normalization

Raw event coordinates remain exactly as captured in `events.x/y` and typed destination coordinates.

Each `analysis_period` may record `home_attacks_towards = left | right | null`.

The away team's direction is the opposite. Analytics normalize the pitch so the event team always attacks towards the right:

- attacking right: normalized coordinates equal raw coordinates;
- attacking left: rotate 180 degrees (`x = 100 - x`, `y = 100 - y`);
- unknown direction: normalized coordinates are `null`.

This convention applies to event origins and pass/kickout destinations. Raw data is never rewritten merely to normalize orientation.

## Security

Analytics views use PostgreSQL `security_invoker = true` so the caller's permissions and the underlying RLS policies remain in force.

A read model must never turn a private analysis into a public one.

## Views

### `analysis_event_facts`

One row per canonical event, enriched with:

- match and period context;
- home/away side;
- attacking direction;
- raw and normalized coordinates;
- typed shot/pass/recovery/turnover/foul/card/kickout/restart details;
- Gaelic score value (`goal = 3`, `point = 1`).

This is the base for timelines, shot maps, heatmaps and spatial filtering.

### `analysis_possession_facts`

One row per possession with:

- duration;
- start/end reason;
- inferred/manual source;
- event count;
- shots, goals, points and score value;
- pass count.

### `analysis_team_stats`

One row per team per analysis. It includes:

- analytical score and official score comparison;
- shots and conversion;
- passes and completion;
- interceptions won;
- explicit recoveries/turnovers;
- discipline;
- kickouts;
- possession efficiency.

Metrics deliberately keep `explicit_recoveries`, `explicit_turnovers` and `interceptions_won` separate instead of summing overlapping concepts blindly.

### `analysis_player_stats`

One row per `analysis_participant`, preserving the historical display snapshot and optional persistent `player_id`.

Statistics are role-based: shooter, assister, passer, receiver, interceptor, recoverer, turnover player, offender, fouled player, card recipient and kickout taker.

### `analysis_insights`

Insights are deterministic facts, not generated prose. Each row exposes:

- a stable `code`;
- severity/level;
- metric value;
- reference threshold/value;
- sample size;
- structured context used to reach the conclusion.

The application translates the code into Galician/Spanish/English copy and can always show the evidence behind it.

Initial rules include:

- official/analytical score mismatch;
- low/high shot conversion (minimum 5 shots);
- low pass completion (minimum 10 passes);
- high intercepted-pass rate (minimum 10 passes);
- low possession efficiency (minimum 5 possessions);
- low kickout retention (minimum 5 kickouts);
- red-card warning.

These thresholds are conservative product defaults, not claims of universal Gaelic-football benchmarks. They can evolve as Gaeliza collects enough real data.

## Coverage and interpretation

A zero count means "zero captured facts of this type", not necessarily "this never happened in the match". Capture-template coverage must be considered before comparing metrics whose denominator depends on exhaustive tagging, especially passes.

The analysis stores a template configuration snapshot so future reporting can explain that coverage.

Insights must apply minimum sample-size guards where small samples would make a percentage misleading.

## Performance

Start with ordinary RLS-aware views. Add materialized views or persisted aggregates only after real query measurements show a need. Per-analysis event volumes are expected to be modest; season/global aggregation should remain database-side rather than downloading raw event history to the browser.
