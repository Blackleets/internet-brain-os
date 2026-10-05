# Goal revision ("Editar Goal")

`POST /api/goals/:id/revisions` edits a confirmed legacy Goal (title, keywords, categories, location)
without creating a new Goal.

## Authority

- Same interactive confirmation boundary as Mission confirmation (`mission-confirmation-boundary.mjs`):
  only the dashboard origin (`dashboard-ui`) or the browser extension origin (`extension-ui`) may revise.
  Token-only requests get **403 `GOAL_REVISION_CONFIRMATION_REQUIRED`**; hostile origins are refused
  before the Goal manager. The body must carry `confirmed: true` (400 otherwise).
- `expectedRevision` (optional, the dashboard always sends it) gives optimistic concurrency:
  **409 `GOAL_REVISION_CONFLICT`** when the Goal moved on.
- A Mission of the Goal with a live Hermes lease blocks the edit: **409 `GOAL_MISSION_RUNNING`**.
- Universal Goals (contract v2) have their own revision contract: **409 `GOAL_REVISION_UNSUPPORTED`**.
- Unknown / inactive Goal: 404 `GOAL_NOT_FOUND`.

## Identity

The Goal id was created as a hash of the Goal's content. **After a revision the id is a historical
identity** (`idBasis: 'created_content'`), not a hash of the current content. Keeping it stable keeps
the Mission id (hash of goal id, agent, cadence), the Mission's `priorAttempts`, Evidence and Finds
attached. Creating a Goal again with the original text returns the revised Goal (same id) instead of a
duplicate.

## Revision

- Legacy Goals are revision 1; each accepted edit increments `revision` and appends the superseded
  content to `revisions` (bounded to 20) with `changedFields`, `supersededAt`, `supersededBy`.
- An unchanged edit is a no-op (`changed: false`, no bump).
- Omitted `keywords` / `categories` are kept when the title is unchanged and re-derived from a new title.
- `currentGoalRevision()` (authorization receipts), the automatic claim gate, the Kernel verifier and the
  goal surface read the legacy `revision`, so they follow the same check Universal Goals use:
  a Mission receipt issued for revision N does not authorize work against revision N+1
  (`authorization_revision_mismatch`) until the user confirms again ("Buscar más").
- Queued / waiting Missions (not started) are re-scoped to the new text and re-authorized for the new
  revision by the same interactive confirmation. Finished Missions, their earlier attempts, Evidence and
  Finds are never touched; "Buscar más" re-scopes them on the next attempt.
- A revision never runs anything.
