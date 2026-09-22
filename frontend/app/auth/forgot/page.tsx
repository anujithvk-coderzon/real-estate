"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/form/Field";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import { inputClass, primaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

const linkClass = "font-medium text-accent transition-colors hover:text-accent-hover";

// Step 1 of resetting a password: ask for the email and send the reset link.
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(""); // set once the request succeeds

  const canSubmit = /\S+@\S+\.\S+/.test(email.trim()) && !sending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    try {
      await api.post("/auth/forgot", { email: email.trim() });
      setSentTo(email.trim());
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSending(false);
    }
  };

  if (sentTo) {
    // The same message whether or not the account exists, so nobody can use
    // this page to find out which emails are registered.
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Check your email</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we&apos;ve sent a link to reset
          the password. It expires in 15 minutes.
        </p>
        <p className="mt-2 text-[14px] text-muted">Nothing there? Check your spam folder, or try again in a minute.</p>
        <div className="mt-8 flex flex-wrap gap-4 text-[14px]">
          <Link href="/auth/login" className={linkClass}>
            Back to sign in
          </Link>
          <button type="button" onClick={() => setSentTo("")} className={linkClass}>
            Use a different email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Forgot your password?</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Enter the email you signed up with, and we&apos;ll send you a link to choose a new one.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>

        <button type="submit" disabled={!canSubmit} className={`w-full ${primaryButton}`}>
          {sending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-[14px] text-muted">
        Remembered it?{" "}
        <Link href="/auth/login" className={linkClass}>
          Sign in
        </Link>
      </p>
    </main>
  );
};

export default ForgotPasswordPage;
