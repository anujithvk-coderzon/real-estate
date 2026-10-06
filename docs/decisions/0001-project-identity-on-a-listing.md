# ADR 0001 — How a listing says which project it is in

- Date: 2026-10-06
- Status: accepted (replaces the "agents can add projects" approach of the same week)

## Context

A sale advertisement for an under-construction unit must carry the project's RERA
registration number. The seller may be the builder, who knows the project, or an
agent, who is selling flats in someone else's project.

The first attempt let an agent create a `Project` row with `builderId = null` and a
new `addedById` column recording who added it. That required a required column on a
populated table (hence the repeated P2022 at `projects.addedById`), and it filled the
project table with half-known records that no one owns or maintains.

## Options

1. **Agents create `Project` rows** (`builderId` nullable, new `addedById`). Rejected:
   a required column on a populated table, and unowned project records.
2. **Agents must wait for the builder to register the project.** Rejected: an agent
   with a genuine listing would be blocked by someone else's inaction.
3. **Agents name the project on the listing** (chosen). The claim lives with the
   listing that makes it, and is shown as a claim.

## Decision

1. A `Project` row is **registered by its builder only**. `builderId` stays required.
2. An agent either:
   - picks a registered project (`GET /project/search` searches all of them), or
   - types the project name and RERA number onto the listing itself, in
     `Listing.projectNameText` and `Listing.projectReraText`, or
   - answers "not part of a project" (a resale, a plot, an old building).
3. For a sale by a builder or an agent the question **must be answered**. When the
   unit is `UNDER_CONSTRUCTION`, "not part of a project" is refused and a typed
   project must include a RERA number, because the advertisement is off-plan.
4. A builder may not type a project name: they register the project, then choose it.
5. The public page derives one `project` object and says whose word it is —
   `inRecords: true` for a registered project, otherwise `statedBy` is the role that
   typed it. The page colours the two differently (accent vs. amber) and never shows
   a verified badge for a number nobody checked.

## Consequences

- Only one new column was needed (`projectReraText`); `projectNameText` already existed.
- The agent's claim and the builder's registration can never be confused, in the
  database or on screen.
- A buyer reading an amber project block is told to check the number on the state
  RERA site. That is honest, and it is also the incentive for builders to register
  their projects here.
- If a builder later registers a project an agent had typed in, old listings keep
  their typed text. Re-pointing them at the new record is not handled yet.

## What I learned

_(to fill in your own words: what P2022 actually told you, and why "add nullable →
backfill → set not null" is the only safe way to add a required column to a table
that already has rows.)_
