# 1. RERA verification is a human decision

Date: 2026-10-30
Status: accepted

## Context

An agent (BROKER) or builder gives us a state RERA registration number. We want
to show buyers whether anyone has checked it.

There is no way to check it automatically:

- No Indian state or union territory publishes a RERA verification API. All 36
  offer a web search page only.
- There is no national API. RERA is administered per state; the number's format
  and its register are both state-specific.
- API Setu lists no RERA service, and no government bulk feed was found.
- Commercial APIs exist (Surepass, Meon). Every one of them is a *project*
  verification product; none documents agent lookups. Neither publishes
  pricing, states its coverage, or says whether its data is live or a cached
  scrape.
- Scraping is not an option. Maharashtra's agent search is captcha-protected
  and Odisha's portal signs and encrypts its own traffic — both have
  deliberately closed the door, and working around that is not something we
  will build.

99acres, Housing.com and MagicBricks do not verify these numbers at all. They
print what the advertiser typed, disclaim it in their terms, and remove
listings on complaint. Their "Verified" badges mean a phone call or a site
visit, not a register check.

## Decision

An operator decides. One person opens the state register, compares it with
what the agent gave us, and presses Approve or Revoke in `/rera` in the admin
app.

The badge on a listing says which of four things is true, never just
"verified": **RERA verified**, **RERA not checked yet**, **No RERA number**,
**RERA revoked** (`frontend/lib/rera.ts`).

We do not buy an API until the queue outgrows a human. If we ever do, it
pre-fills the queue; it does not approve anything on its own, so a stale
vendor costs us convenience rather than credibility.

## The procedure

For each row in the queue:

1. **Open that state's register.** The state in the row decides which one; a
   Kerala number cannot be confirmed anywhere but Kerala's register.
2. **Search by the number first**, then by name if that returns nothing. A
   number that matches nothing is not a rejection yet — see step 5.
3. **Check four things, all four:**
   - the number exists in that register;
   - it is an **agent** registration, not a project or promoter number (people
     paste project numbers, which look similar);
   - the **name** on the register matches the account (the queue flags a
     mismatch in red, but read it yourself — initials and firm names differ
     legitimately);
   - the registration is **currently valid**, not lapsed or suspended.
4. **Write down the validity-to date** before you press anything. Without it
   nobody can tell later whether the badge is still true.
5. **Decide:**
   - all four match → **Approve**;
   - the number is valid but filed in a different state than claimed → fix the
     state, do not reject;
   - the name differs for a reason you can see (married name, firm vs person)
     → ask them, do not guess;
   - lapsed → **not a revoke**: it was real. Tell them to renew and resubmit;
   - no such number, or a project number, or a name that cannot be explained →
     do not approve, and say why.

## Consequences

- A badge is only as fresh as its last check. Registrations run five years, so
  `agentReraVerifiedAt` alone will eventually describe a lapsed registration as
  verified. An expiry date, or a re-check after N months, is required —
  otherwise this decision quietly becomes a lie. **Open.**
- Rejecting and revoking are not the same act, and the schema has one state
  for both. `AgentReraForm` tells a rejected agent that "the registry removed"
  their registration, which is false when an operator rejected a typo.
  **Open.**
- No reason reaches the agent, so they resubmit the same wrong number.
  **Open.**
- The declared-by-default model only works if wrong numbers can be reported.
  There is no report channel on a listing yet. **Open.**
- Whether this platform itself needs RERA agent registration in the states it
  operates in is a legal question, not a technical one. MahaRERA served that
  notice on Magicbricks, 99acres, Makaan and Housing.com. **Open, for advice.**
