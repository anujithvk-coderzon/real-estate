"use client";

import { useState } from "react";
import { api, setAccessToken } from "@/lib/api";

const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-panel px-3 py-2 text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-[15px]";

const labelClass = "mb-1.5 block text-[13px] font-medium text-muted";

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-[18px] w-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
  >
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 20 20 4" />}
  </svg>
);

// Signs in against the same /auth/login the public site uses, then refuses
// anybody whose role is not ADMIN. One identity system, one password reset
// flow, and every action attributable to a person rather than to a shared
// operator credential.
const SignInForm = ({ onSignedIn }: { onSignedIn: () => void }) => {
  const [fields, setFields] = useState({ email: "", password: "" });
  const [reveal, setReveal] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields({ ...fields, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const login = await api.post("/auth/login", fields);
      setAccessToken(login.data.accessToken);

      // Signing in is not the same as being allowed in. Checked before going
      // anywhere, and it fails closed: anything that is not a confirmed ADMIN
      // is refused and the token is thrown away.
      const me = await api.get("/auth/me");
      if (me.data?.user?.role !== "ADMIN") {
        // Logout sits behind isAuthorized, so it has to go out while the
        // token is still set. Clearing first turns it into a 401 and leaves
        // the refresh cookie alive in the browser.
        await api.post("/auth/logout").catch(() => {
          // Already signed out as far as this browser is concerned.
        });
        setAccessToken(null);
        // Deliberately the same message as a wrong password: telling someone
        // "you are not an admin" confirms their password was right.
        setError("Those details are not valid.");
        setPending(false);
        return;
      }

      onSignedIn();
    } catch {
      setError("Those details are not valid.");
      setPending(false);
    }
  };

  const canSubmit =
    fields.email.trim() !== "" && fields.password !== "" && !pending;

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        Restricted
      </p>
      <h1 className="mt-3 font-display text-[28px] leading-tight">
        Staff sign in
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Use the operator account. There is no self-service here.
      </p>

      <div className="mt-7 space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            // The only field that can be filled first, so the cursor starts
            // here rather than making every sign-in begin with a click.
            autoFocus
            value={fields.email}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              required
              value={fields.password}
              onChange={handleChange}
              // Caps Lock is the commonest reason a correct password is
              // rejected, and the one thing the browser will not tell you.
              onKeyUp={(event) =>
                setCapsOn(event.getModifierState?.("CapsLock") ?? false)
              }
              className={`${inputClass} pr-12`}
            />
            {/* Typing a password blind is the worst part of any staff login.
                44px target, and the label says what it will do, not what is
                currently shown. */}
            <button
              type="button"
              onClick={() => setReveal(!reveal)}
              aria-pressed={reveal}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <EyeIcon off={reveal} />
            </button>
          </div>
          {capsOn && (
            <p className="mt-1.5 text-[12px] text-muted">Caps Lock is on.</p>
          )}
        </div>
      </div>

      {/* Fixed height, so the panel does not jump when the message appears and
          the button stays where the pointer already is. */}
      <div className="mt-4 min-h-[20px]" aria-live="polite">
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
};

export default SignInForm;
