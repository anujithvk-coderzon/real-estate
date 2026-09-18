"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authReady, isSignedIn } from "@/lib/api";
import { primaryButton } from "@/lib/ui";

// Invites visitors to list their own property. Hidden for signed-in users,
// who already have "List a property" in the sidebar.
const ListPropertyPrompt = () => {
  const [visitor, setVisitor] = useState(false);

  useEffect(() => {
    authReady.then(() => setVisitor(!isSignedIn()));
  }, []);

  if (!visitor) return null;

  return (
    <aside
      aria-labelledby="list-prompt-heading"
      className="flex flex-col gap-4 rounded-2xl bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between lg:max-w-md"
    >
      <div>
        <h2 id="list-prompt-heading" className="text-[16px] font-semibold">
          Want to list your property?
        </h2>
        <p className="mt-1 text-[14px] text-muted">Create an account and reach buyers and renters across Kerala.</p>
      </div>
      <Link href="/auth/register" className={`shrink-0 text-center ${primaryButton}`}>
        Sign up
      </Link>
    </aside>
  );
};

export default ListPropertyPrompt;
