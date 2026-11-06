# 2. A closed listing is reachable, not searchable

Date: 2026-11-06
Status: accepted

## Context

`ListingStatus` has six values — `DRAFT`, `ACTIVE`, `SOLD`, `RENTED`,
`EXPIRED`, `TAKEN_DOWN` — and until today only three of them could ever
happen:

| Transition | Who | Where |
| --- | --- | --- |
| `DRAFT → ACTIVE` | owner | `listingPublishingService` |
| `ACTIVE → TAKEN_DOWN` | admin | `admin.service.ts`, with a notification |
| `TAKEN_DOWN → ACTIVE` | admin | `admin.service.ts` |

Nothing wrote `SOLD` or `RENTED`. Nothing wrote `EXPIRED`, and `expiresAt` was
never set or read. `updateListingService` could not change the status either:
`listing.validation.ts` has no such field, so it was stripped.

The display layer, meanwhile, was finished. `MyListings` offers **Sold** and
**Rented** filter tabs, `MySpecificListing` has badge copy for both, and
`ListingCard` carries a badge for all six. A seller could open the Sold tab and
find it permanently empty — the site advertised a state the system could not
reach.

This is the same failure as the map legend and the fifth type selector: one
decision expressed in two places, where only one place got finished.

## Decision

### Who owns which status

- **Owner:** `DRAFT`, `ACTIVE`, `SOLD`, `RENTED`.
- **System:** `EXPIRED` (a job over `expiresAt`; still unbuilt).
- **Admin:** `TAKEN_DOWN`, in and out. The owner can never leave it —
  otherwise moderation is a suggestion.

Allowed owner transitions: `DRAFT → ACTIVE` (publish, unchanged),
`ACTIVE → SOLD | RENTED`, `SOLD | RENTED → ACTIVE` (relist), and
`ACTIVE | SOLD | RENTED → DRAFT` (unlist). The relist matters more than it looks: without it, a
seller whose buyer backs out has to post the whole listing again.

**Unlisting is stronger than closing, and the wording has to say so.** A sold
listing keeps its page; a draft is excluded from every public query, so its page
stops opening and every link already sent to a buyer shows nothing found. The
button therefore says **Unlist**, not "Move to draft", and it is offered only on
the edit page, where there is room for a sentence explaining it. Leaving `DRAFT`
is still publishing and still goes through `/publish/:id`, which refuses a
listing with no contact details — `lib/listingStatus.ts` routes that one call so
no surface can publish by the back door.

### Sold and rented are one decision, not two

A `SALE` listing can only become `SOLD`; `RENT` and `PG` can only become
`RENTED`. The seller is shown **one** button and the value is derived from
`listingType` (`closedStatusFor` in `frontend/lib/listing.ts`). Offer both and
some rentals get marked sold, at which point neither status means anything and
the tabs are noise again.

### What buyers see

"Visible" is two permissions, and they get different answers:

| | ACTIVE | SOLD / RENTED | DRAFT | TAKEN_DOWN |
| --- | --- | --- | --- | --- |
| Reachable by direct link | yes | **yes** | no | no |
| In search, map and grids | yes | **no** | no | no |
| Contact buttons shown | yes | **no** | no | no |

**Reachable**, because the link is already out in the world — in WhatsApp
threads (the enquiry prefill in `ListSpecific` sends it), in forwards, in
Google's index. A 404 tells the buyer nothing; a "this has been sold" line puts
`SimilarListings` in front of someone who has just proved what they are looking
for and in which locality. A 404 is a lost buyer; a banner is a redirected one.

**Not searchable**, because a buyer filtering "plots under ₹50 L" is asking
what they can buy today. Every closed result is a wasted tap, and it quietly
inflates our inventory — the site looks busier than it is.

**Not contactable**, which is the part that is easy to underestimate. If the
phone and WhatsApp buttons stay live, the seller keeps taking calls about land
they sold months ago, and they will not mark the next one. The reward for
telling us has to be *fewer* useless calls.

## Consequences

- `SpecificListFetchingService` widens from `status: 'ACTIVE'` to
  `status: { in: ['ACTIVE', 'SOLD', 'RENTED'] }`. Search
  (`searchService`, `listsFetchingService`) and `similarListingService` keep
  filtering `ACTIVE` and are already correct. `similarListingService` looks the
  source listing up by slug with no status filter, so similar properties still
  load on a closed page.
- The seller's public profile (`sellerListsFetchingService`) still lists only
  `ACTIVE`. A "recently sold" group there would be real social proof for a
  broker or builder. **Open.**
- Closing a listing asks first; reopening does not. Closing takes it out of
  search and takes its contact buttons with it, which is not what a mis-tap
  should cost. Reopening is the undo, and a dialog in front of an undo teaches
  people that the first dialog meant nothing.
- All three surfaces — the owner's card grid, the dashboard page and the public
  page when its owner is reading it — go through
  `components/listing/AvailabilityActions.tsx`, which owns the available move,
  the request and the question. `lib/listingStatus.ts` owns the call itself, so
  the endpoint is named once. The card shows only the next move (its badge
  already says which state it is in); the two pages show both states as a
  switch.
- `EXPIRED` is still unreachable. `expiresAt` needs setting at publish time —
  not at create, since a draft that sat for three months would otherwise go
  live already expired — and a job to act on it. **Open.** The **Expired** tab
  was removed from `MyListings` until that exists: a filter that can only ever
  return nothing is the same lie the Sold tab was. The badge copy stays, in
  `STATUS_DISPLAY` and `STATUS_BADGE`, so the day a listing does hold the status
  it renders rather than falling through to a blank.
- Sold prices are the most valuable data this produces, and we do not publish
  them. Transacted prices as market evidence needs density we do not have and
  the seller's consent we have not asked for. **Open, deliberately.**
- Three places spell these statuses in prose: `STATUS_DISPLAY`
  (`MySpecificListing`), `STATUS_BADGE` (`ListingCard`) and the tabs in
  `MyListings`. They agree today because they were edited together. They will
  not stay that way. **Open.**

## The contract

`PATCH /list/status/:listingId`, authorized, owner-only.

```json
{ "status": "SOLD" }
```

- Accepts `ACTIVE`, `SOLD`, `RENTED`, `DRAFT`. `EXPIRED` and `TAKEN_DOWN` are
  a 400 — they belong to the expiry job and to moderation.
- Rejects the status the listing type cannot reach: `SOLD` on a `RENT` or `PG`
  listing, `RENTED` on a `SALE` one. The UI derives this, but a UI is not a
  constraint.
- Rejects any change **from** `DRAFT` (publish is the only way out, and it has
  a checklist), from `EXPIRED` and from `TAKEN_DOWN`.
- Going to `ACTIVE` re-checks `contactName` and `contactPhone`, the same bar
  publishing sets: an edit can empty those columns, and without the check a
  relisted listing is back in search with no way to reach the seller.
- Returns a message the frontend shows verbatim, as `publishListing` does.
