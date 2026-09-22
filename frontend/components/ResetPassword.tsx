"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/form/Field";
import PasswordInput from "@/components/form/PasswordInput";
import PasswordRules, { meetsPasswordRules } from "@/components/form/PasswordRules";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import { primaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

const linkClass = "font-medium text-accent transition-colors hover:text-accent-hover";

// Choose a new password from the emailed reset link.
const ResetPassword = ({ token }: { token: string }) => {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [linkBroken, setLinkBroken] = useState(false); // expired or already used

  const canSubmit = meetsPasswordRules(password) && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.post(`/auth/reset/${token}`, { password });
      setDone(true);
    } catch (error) {
      const message = apiMessage(error);
      // The backend says "expired" or "Invalid link" when the link can't be used.
      if (/link|expired/i.test(message)) setLinkBroken(true);
      else errorToast(message);
    } finally {
      setSaving(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">{children}</main>
  );

  if (done) {
    return shell(
      <>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Password changed</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          You&apos;ve been signed out on all devices. Sign in with your new password.
        </p>
        <Link href="/auth/login" className={`mt-8 inline-block text-center ${primaryButton}`}>
          Sign in
        </Link>
      </>,
    );
  }

  if (linkBroken) {
    return shell(
      <>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">This link has expired</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Reset links work once, for 15 minutes. Ask for a new one and use it straight away.
        </p>
        <Link href="/auth/forgot" className={`mt-8 inline-block text-center ${primaryButton}`}>
          Send a new link
        </Link>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">You&apos;ll use it the next time you sign in.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <Field id="new-password" label="New password">
          <PasswordInput
            id="new-password"
            name="new-password"
            autoComplete="new-password"
            autoFocus
            aria-describedby="new-password-rules"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRules id="new-password-rules" value={password} />
        </Field>

        <button type="submit" disabled={!canSubmit} className={`w-full ${primaryButton}`}>
          {saving ? "Saving…" : "Save new password"}
        </button>
      </form>

      <p className="mt-6 text-[14px] text-muted">
        <Link href="/auth/login" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </>,
  );
};

export default ResetPassword;
