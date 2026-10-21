# Gaeliza v2 event model

This document defines the canonical representation rules for match events in Gaeliza v2.

The goal is to avoid double-counting and make every statistic traceable back to one physical occurrence.

## Core rule: one physical occurrence, one canonical event

When a specific event already describes what physically happened, Gaeliza must not create generic duplicate events for the same occurrence.

Derived statistics such as turnovers, recoveries, saves, blocks, scoring and possession changes are computed from the canonical event where possible.

## Pass interception

If the pass itself is captured, an interception is represented as:

- `events.event_type = 'pass'`
- `pass_events.result = 'intercepted'`
- participant roles such as `passer`, optional `intended_receiver`, and `interceptor`

Do **not** also create a `recovery` event and a `turnover` event for that same physical occurrence.

If a quick capture template does not record passes, an interception may instead be represented as:

- `events.event_type = 'recovery'`
- `recovery_events.method = 'interception'`

Analytics must normalize both representations into the same semantic interception/recovery fact without double-counting. Metrics whose denominator depends on captured passes must also expose capture coverage/template context.

## Shot outcomes

A saved or blocked shot remains a single shot event:

- `shot_events.result = 'saved'`, or
- `shot_events.result = 'blocked'`

Do **not** add a second save/block event for that same shot.

A standalone `block` event is reserved for a defensive block that is not already represented as the result of a logged shot.

Goals and points are also shot results. Team score is derived from canonical shot outcomes rather than stored again as analysis truth.

## Generic recovery and turnover events

Use `recovery` and `turnover` only when no more specific captured event already expresses the occurrence.

Examples:

- bad control with no pass involved -> `turnover(cause='bad_control')`
- loose ball won -> `recovery(method='loose_ball')`
- logged intercepted pass -> only `pass(result='intercepted')`

This rule is essential for correct aggregate metrics.

## Cards and fouls

A card is a separate administrative event because it may be shown later than the foul and can exist independently.

`card_events.related_foul_event_id` may link it to the relevant foul when known.

The linked event must:

- be a `foul` event;
- belong to the same analysis.

## Kickouts

Kickouts are canonical events with typed detail for:

- short/long;
- result;
- optional destination coordinates.

Roles may include `kicker`, `target`, `kickout_receiver`, and `opponent`.

`target` and actual receiver are intentionally separate concepts.

## Participants

Event participant roles always reference `analysis_participants`, never persistent `players` directly.

This keeps historical snapshots stable and supports:

- temporary rival identities such as `#8`;
- later linking of a temporary participant to a persistent player;
- public reports without exposing a private player record directly.

## Possessions

Possessions are first inferred from canonical events and may then be corrected manually.

- `source = 'inferred'`: the inference process may replace/update the row.
- `source = 'manual'`: automatic inference must not overwrite the row.

A possession belongs to exactly one analysis, team and period.

Saved/blocked/post shots do not necessarily end possession. Goals and points do. A miss normally ends possession; an opponent gain ends possession.

The inference algorithm is a separate layer and must obey these canonical-event rules.

## Coordinates

Raw event coordinates are normalized to `0..100` and stored unchanged.

Attacking direction is handled later by the analytics/query layer. Raw coordinates are never rewritten merely to normalize direction.

## Typed details

Core analytical fields live in typed tables such as:

- `shot_events`
- `pass_events`
- `foul_events`
- `kickout_events`

JSONB is appropriate for capture-template configuration and RPC input, but not as the source of truth for core event analytics.

## Editing

Events remain editable in v1. There is no event-version audit trail in the initial release.

Changing the physical type of an event should be treated as replacing the event, not mutating a shot into a pass while old typed detail remains attached. Database hardening enforces this invariant.
