# Gaeliza v2 historical analytics

Historical analytics aggregate canonical analysis facts across matches without persisting a second statistical source of truth.

## Primary analysis per match

A user may create multiple analyses for the same match. Counting every analysis would duplicate the same match in season totals.

`analyses.is_primary_for_history` identifies the owner's reference analysis for that match.

Rules:

- at most one primary analysis per `(owner_user_id, match_id)`;
- the first analysis created through `create_analysis()` becomes primary when no reference exists yet;
- `set_primary_analysis()` atomically switches the reference to another analysis of the same owner/match;
- duplicate analyses remain fully usable, but only the primary one can contribute to historical aggregation.

The primary flag does not imply that an analysis is finished. Historical views also require `status = 'completed'`, so drafts and in-progress work never contaminate season statistics.

## Ownership boundary

Historical analytics are personal to the analyst.

`my_team_match_history` and `my_player_match_history` include only analyses where:

- `owner_user_id = auth.uid()`;
- `is_primary_for_history = true`;
- `status = 'completed'`.

A public analysis owned by somebody else is deliberately not mixed into the current user's historical dataset. Different analysts can have different capture templates, corrections and interpretations, so silently merging their datasets would produce misleading metrics.

Anonymous Auth users still have an `auth.uid()` and can use this model during their guest session. Truly unauthenticated (`anon` Postgres role) callers receive no historical API access.

## Team evolution and scouting

`my_team_match_history` contains one row per team per completed primary analysis with match context and the opponent.

The same dataset supports both:

- own-team evolution: filter by your team;
- opponent scouting: filter by the rival team you have analysed.

Scouting therefore means "what I have observed and tagged about this opponent", not an unverified global aggregate.

Supported summary filters include:

- season;
- competition;
- opponent;
- date range.

## Persistent player history

Cross-match player history requires a stable identity, so `my_player_match_history` includes only `analysis_participants` linked to a persistent `player_id`.

Temporary identities such as `#8` remain valid inside a match analysis but are intentionally excluded from cross-match aggregation until they are linked to a persistent player.

A shared player identity with `permission = use` may contribute to the receiving user's own analyses without granting permission to edit the global player identity.

## Aggregation semantics

Percentage metrics are recomputed from summed numerators and denominators, rather than averaging match percentages.

For example:

- shot conversion = total scoring shots / total shots;
- pass completion = total completed passes / total passes;
- scoring-possession rate = total scoring possessions / total possessions;
- score per possession = total score value / total possessions.

Average possession duration is weighted by the number of possessions in each match.

This avoids mathematically incorrect averages when match sample sizes differ.

## Capture coverage

A historical zero means zero captured canonical facts, not necessarily that the event never happened.

Metrics whose denominator depends on exhaustive capture (especially passes) must be interpreted with the analysis template/configuration coverage in mind. Gaeliza should not compare partially captured and exhaustively captured datasets without making that limitation visible to the user.

## Future scaling

The initial implementation uses ordinary RLS-aware views plus SQL aggregation functions. Do not introduce materialized views or persisted season totals until production measurements show a real performance need.
