"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "@/components/form/Field";
import GoogleButton from "@/components/form/GoogleButton";
import PasswordInput from "@/components/form/PasswordInput";
import { api, setAccessToken } from "@/lib/api";
import { errorToast, successToast } from "@/lib/toast";
import { inputClass, primaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

const linkClass = "font-medium text-accent transition-colors hover:text-accent-hover";

const LoginPage = () => {
  const router = useRouter();
  const [fields, setFields] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields({ ...fields, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post("/auth/login", fields);
      setAccessToken(response.data.accessToken);
      successToast(response.data.message);
      router.push("/");
    } catch (error) {
      errorToast(apiMessage(error));
      setSubmitting(false);
    }
  };

  const canSubmit = fields.email.trim() !== "" && fields.password !== "" && !submitting;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Sign in</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Manage your listings and post new properties.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
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
            autoComplete="current-password"
            value={fields.password}
            onChange={handleChange}
          />
          <Link href="/auth/forgot" className={`mt-2 inline-block text-[13px] ${linkClass}`}>
            Forgot password?
          </Link>
        </Field>

        <button type="submit" disabled={!canSubmit} className={`w-full ${primaryButton}`}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <GoogleButton />

      <p className="mt-6 text-[14px] text-muted">
        New here?{" "}
        <Link href="/auth/register" className={linkClass}>
          Create an account
        </Link>
      </p>
    </main>
  );
};

export default LoginPage;
