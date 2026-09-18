"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import { primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

const REDIRECT_SECONDS = 3;

type Status = "verifying" | "verified" | "failed";

const card = "rounded-lg border border-line bg-panel p-6";

const VerifyToken = ({ token }: { token: string }) => {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verifying");
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const requested = useRef(false);

  // The token works only once. React runs effects twice in development, so
  // the ref makes sure the request is sent a single time.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    api
      .post(`/auth/verify/${token}`)
      .then(() => setStatus("verified"))
      .catch((error) => {
        errorToast(apiMessage(error));
        setStatus("failed");
      });
  }, [token]);

  // After verifying, count down and go to the login page.
  useEffect(() => {
    if (status !== "verified") return;

    const tick = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    const redirect = setTimeout(() => router.push("/auth/login"), REDIRECT_SECONDS * 1000);

    return () => {
      clearInterval(tick);
      clearTimeout(redirect);
    };
  }, [status, router]);

  if (status === "verifying") {
    return (
      <div className={card}>
        <h1 className="text-[20px] font-semibold tracking-tight">Verifying your email</h1>
        <p className="mt-2 text-[15px] text-muted">One moment.</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className={card}>
        <h1 className="text-[20px] font-semibold tracking-tight">We could not verify this link</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Verification links work only once. If you have already verified, sign in.
        </p>
        <Link href="/auth/login" className={`mt-5 block text-center ${secondaryButton}`}>
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className={card}>
      <h1 className="text-[20px] font-semibold tracking-tight">Email verified</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Your account is active. Taking you to login in{" "}
        <span className="font-mono text-ink">{Math.max(secondsLeft, 0)}</span>{" "}
        {secondsLeft === 1 ? "second" : "seconds"}.
      </p>
      <Link href="/auth/login" className={`mt-5 block text-center ${primaryButton}`}>
        Continue to login
      </Link>
    </div>
  );
};

export default VerifyToken;
