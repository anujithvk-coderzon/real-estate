# 3. Sellers publish; photographs wait

Date: 2026-11-11
Status: accepted

## Context

Until today any signed-in account could put a property into public search
unaided. `listingPublishingService` checked three things — not already
`ACTIVE`, a contact name, a contact phone — and wrote `status: 'ACTIVE'`. The
only moderation was reactive: a visitor reports a listing, it lands in the
flagged queue, an operator takes it down. By then the listing has been in
search for however long it took somebody to complain.

The things that get a listing removed are almost all **in the photographs** —
images lifted from another site, a watermark, a phone number painted across the
picture, interiors that are not of this property. All of it is visible before
publication and none of it needs a complaint to find.

## The version that was rejected

The first attempt gated **publishing** on an operator's approval: a new listing
sat at `PENDING` with a dead Publish button reading "Waiting for approval".

It was built, and then rejected before it shipped, for one reason that
outweighed everything in its favour: it asks the seller to finish all the work
and then wait on us for the one thing they came here to do. In that state the
listing is worth nothing to them and nothing to a buyer either, and every hour
of queue backlog is an hour of a property that cannot be found at all. A
marketplace whose supply side is blocked on an internal queue has made its own
staffing problem into its sellers' problem.

## Decision

**Publishing is never gated. The media is.**

A seller publishes whenever their own checklist passes — a photo, a map pin, a
description. The listing enters search immediately with its full text, price,
address and contact details. What waits for an operator is every photograph and
the video, and until each one is cleared it is simply not sent to anybody but
its owner and the admin panel.

**The gate is on each image, and there is no listing-level copy of it.**
`approved Boolean @default(false)` plus `reviewNote String?` on both
`ListingImages` and `ListingVideos` — three states out of two columns, no enum:

```
approved false, reviewNote null  →  nobody has looked at it yet
approved false, reviewNote set   →  looked at, declined, reason attached
approved true                    →  showing; the note is cleared
```

Per image, because a flag on the listing would mean a seller who adds an
eleventh photo loses the ten already cleared until somebody re-reads them — a
visible regression on a live listing, caused by the seller doing something
completely innocent.

An intermediate version of this *also* kept `approval`, `approvalNote` and
`approvalDecidedAt` on `Listing`, to drive the queue and hold the operator's
sentence. Both were dropped: a second column answering "may buyers see this"
is a second source of truth, and the one that goes stale, because it has to be
written by hand on every path that touches the media while the media's own
flags are simply the state of the rows.

The note belongs on the item for the same reason it is the only honest place
for it: *"the first one is a screenshot from another site"* is useless filed
against a listing that has ten photographs.

It also makes the swap-after-approval problem *disappear* rather than defending
against it. A new row is `false` because that is its column default, so an
unread photograph cannot be shown whether or not any particular code path
remembers to mark it. The earlier design needed a `sendBackForReview` call on
four separate media endpoints and would have leaked the day somebody added a
fifth; that function and all its call sites are deleted.

**The filter is repeated at each public call site, not hidden in a helper.**
Five services read images for the public — `listsFetchingService`,
`SpecificListFetchingService`, `searchService`, `sellerListsFetchingService`,
`similarListingService` — and each carries its own `where: { approved: true }`.
A helper would be tidier and would also be the thing somebody forgets to call,
and forgetting here does not fail loudly: it *leaks*. An unread photograph
appears on the site and nothing in any log says so.

The owner's own endpoints are deliberately **not** filtered, and send `approved`
alongside each photo. A seller whose own dashboard hid their upload would
conclude it had failed and do it again.

**The seller is told twice, in two different lifetimes.** Publishing returns a
message that becomes the toast, *and* writes a notification. A toast is gone in
four seconds; a seller who then looks at their live listing, sees no
photographs and has nothing left on screen explaining why is a seller who
thinks the upload broke.

**The public page distinguishes "no photos" from "photos not shown".** The page
already had copy for the first case — "The seller has not added photos yet" —
and printing that over a listing whose eight photographs are sitting in our own
queue is a false statement about a real person on their own page, which blames
them for a wait that is ours. `SpecificListFetchingService` therefore sends
`photosPending`, and the page says "Photos for this property are not available
yet" instead. No count and no reason: a buyer does not need to know that
somebody here is checking the pictures, and "being reviewed" on a property page
reads as a suspicion about the property.

**The operator queue is cut by urgency, not by novelty.** Its filter is "has
unapproved media", not "approval is `PENDING`" — a listing with no photographs
has nothing here to decide, and a queue containing work that cannot be done is
a queue people stop trusting. Three tabs:

| Tab | Filter | Why it is in this order |
| --- | --- | --- |
| **Live, photos hidden** | media with `approved false, reviewNote null`; `status` not `DRAFT`/`TAKEN_DOWN` | In search *now* with no picture. A buyer is on that page and the seller is losing the enquiry |
| **Drafts** | same, `status` `DRAFT` | Nobody can see it, nobody is losing anything, the seller is not blocked |
| **Sent back** | any media with `reviewNote` set | A decision an operator cannot look up again is one they cannot stand behind when the seller writes in |

A *declined* item is deliberately not "waiting": it is with the seller, and
listing it as work would mean an operator re-reading their own rejection every
time they open the queue.

This is the reverse of the first design's priority, where never-published
listings came first because their owners were blocked. Nobody is blocked now,
so the cost has moved to the listings that are already up.

**Approve releases every waiting item at once; rejection is aimed at one.**
The operator has the whole set on one card, and ten clicks to say "yes" ten
times is how a queue stops being read properly — so `PATCH
/admin/listing/media/approve/:id` is keyed on the listing. A rejection is
`PATCH /admin/listing/media/reject/:kind/:id`, keyed on the single photograph
or the video, because that is how the problem actually arrives: nine photos are
fine and the first is a screenshot. Declining the whole set to deal with one of
them hides eight innocent pictures and makes the note unreadable — *"which
one?"* is the first thing the seller asks.

**A rejection takes nothing away.** The note is compulsory (15–300 characters)
and is the entire point of the action: "rejected" alone tells a seller
something is wrong with their property and nothing about what, which produces a
support email and a listing edited at random until it passes. The listing stays
where it is, every already-cleared photo keeps showing, and the unapproved ones
stay exactly where they were a moment ago.

**Restoring a taken-down listing does not release its photographs.** Restore
answers "may this listing be on the site". If a photograph is why it came down,
clearing it as a side effect of putting the listing back is precisely the wrong
move. The listing reappears in the live queue with its photos still waiting.

**Publishing no longer undoes a take-down.** Found while auditing every write
that can set `ACTIVE`, and it predates all of this: publish refused only a
listing that was already `ACTIVE`, so the owner of a listing an operator had
taken down could call the endpoint and put it straight back into search.
`listingAvailabilityService` guarded `TAKEN_DOWN` explicitly and publish did
not. Closed in the same change.

## Consequences

**The text goes out unread, and that is the real cost of this decision.** A
phone number typed into the description is the one that matters most: the site
deliberately controls how a buyer reaches a seller
(`contactPhoneVisibility`, `contactWatsappVisibility`,
`contactInappVisibility`), and a number in free text routes around all three
and around the chat system with it. False RERA claims in `projectReraText` and
spam links are the same shape of problem. The reactive flagged queue is the only
thing catching any of it.

The cheapest real mitigation is **not** a human reading every description — it
is a pattern check for phone numbers and URLs in free text at write time, which
needs no queue and no operator. That is the obvious next piece of work and it
is not done here.

**A live listing with no visible photograph performs badly.** On a property
site that is close to invisible, so a long backlog still hurts the seller — just
less than a listing that does not exist at all. The "Live, photos hidden" tab
exists to make that cost impossible to ignore.

**The owner page says nothing about how long it will take.** A number there is a
promise made on somebody else's behalf, and a seller told "within 24 hours" who
waits thirty has been lied to by the page.

Deliberately not done yet:

- **No bulk approve across listings.** It would be used, and the first thing it
  would clear unread is the photograph this whole decision exists to catch.
- **No auto-approval for trusted accounts.** Defensible later on evidence — an
  account with several cleared listings and no complaints is a different risk
  from a new one. Not on day one with no evidence either way.

`20261111140000_media_approval` carries a backfill that is not optional: it
sets `approved = true` on the images and videos of every non-draft listing.
Without it, every photograph on every listing already in search disappears the
moment it is applied, and the only way back is an operator opening each one.
Media on drafts stays `false`: those listings have never been read, and from
today that is what the queue is for. The same migration drops the listing-level
columns that `20261111120000_listing_approval` added, with `IF EXISTS` guards
so it applies cleanly whether that one has already run or is still pending.
