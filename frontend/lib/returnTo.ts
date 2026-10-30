// Where to send somebody once they have signed in.
//
// Two ways in, because there are two shapes of journey:
//
//   login:    /property/<slug> → /auth/login?next=/property/<slug> → back
//   register: /property/<slug> → /auth/register → email → /verify/<token>
//             → /auth/login → back
//
// The second one leaves the tab, and may well come back in a different one, so
// a query parameter cannot survive it. Hence the stored copy, which the login
// page falls back to when there is no ?next.

const KEY = "returnTo";
// Long enough to read an email and click the link, short enough that a path
// from last week never hijacks a sign-in.
const MAX_AGE = 60 * 60 * 1000;

// Only our own paths. Without this check, /auth/login?next=https://evil.example
// turns the sign-in page into a credential-phishing hop that wears your
// domain: the victim really is on your site, really does sign in, and is then
// handed to somebody else's page. A leading "//" is the same attack — the
// browser reads //evil.example as a protocol-relative URL — and a backslash is
// how some browsers can be tricked into reading one.
export const safePath = (value: string | null | undefined) =>
  value &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\")
    ? value
    : null;

// via marks the Google journey, which does not come back through the login
// page at all: the backend redirects straight to FRONTEND_URL. Only that
// journey may be consumed by the landing page, so an abandoned "Login to
// contact" can never bounce somebody who later arrives home by other means.
export const rememberReturn = (path: string, via?: "google") => {
  if (!safePath(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now(), via }));
  } catch {
    // Private mode, or storage full. The ?next parameter still covers the
    // common journey, so this is a convenience and never a requirement.
  }
};

// Reads and clears: a return path is used once. Leaving it behind would send
// somebody to a property page the next time they signed in for any reason.
const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as {
      path?: unknown;
      at?: unknown;
      via?: unknown;
    };
    if (typeof saved.path !== "string" || typeof saved.at !== "number")
      return null;
    if (Date.now() - saved.at > MAX_AGE) return null;
    const path = safePath(saved.path);
    return path ? { path, via: saved.via } : null;
  } catch {
    return null;
  }
};

const clear = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: a path we cannot clear is a path that expires in an hour.
  }
};

// Reads and clears: a return path is used once. Leaving it behind would send
// somebody to a property page the next time they signed in for any reason.
export const takeReturn = () => {
  const saved = read();
  clear();
  return saved?.path ?? null;
};

// The Google round trip only. Consumed on the page the backend lands on, and
// only for a journey that started at a Google button.
export const takeGoogleReturn = () => {
  const saved = read();
  if (saved?.via !== "google") return null;
  clear();
  return saved.path;
};

// The link into auth from wherever the visitor is standing.
export const authHref = (
  base: "/auth/login" | "/auth/register",
  from: string,
) => (safePath(from) ? `${base}?next=${encodeURIComponent(from)}` : base);
