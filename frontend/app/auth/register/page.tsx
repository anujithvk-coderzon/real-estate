"use client";

import { useState } from "react";
import { Field } from "@/components/form/Field";
import PasswordInput from "@/components/form/PasswordInput";
import VerifyEmailNotice from "@/components/VerifyEmailNotice";
import { api } from "@/lib/api";
import { errorToast, successToast } from "@/lib/toast";
import { inputClass, primaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";
import { passwordRules } from "@/lib/validation/auth";

const RegisterPage = () => {
  const [fields, setFields] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields({ ...fields, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/register", fields);
      successToast("Account created. Check your email to verify it.");
      setRegisteredEmail(fields.email);
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const allRulesMet = passwordRules.every((rule) => rule.test(fields.password));

  if (registeredEmail) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <VerifyEmailNotice email={registeredEmail} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Create your account</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        You need an account to post and manage property listings.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <Field id="name" label="Full name">
          <input
            id="name"
            name="name"
            autoComplete="name"
            value={fields.name}
            onChange={handleChange}
            className={inputClass}
          />
        </Field>

        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={handleChange}
            className={inputClass}
          />
        </Field>

        <Field id="password" label="Password">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={fields.password}
            onChange={handleChange}
            aria-describedby="password-rules"
          />
          {/* Feedback only — the backend is what enforces these rules. */}
          {fields.password && (
            <ul id="password-rules" className="mt-3 space-y-1.5">
              {passwordRules.map((rule) => {
                const met = rule.test(fields.password);
                return (
                  <li key={rule.id} className={`flex items-center gap-2 text-[13px] ${met ? "text-accent" : "text-muted"}`}>
                    <span aria-hidden="true" className="w-3 text-center">
                      {met ? "✓" : "•"}
                    </span>
                    {rule.label}
                    <span className="sr-only">{met ? "— met" : "— not met"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Field>

        <button type="submit" disabled={submitting || !allRulesMet} className={`w-full ${primaryButton}`}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </main>
  );
};

export default RegisterPage;
