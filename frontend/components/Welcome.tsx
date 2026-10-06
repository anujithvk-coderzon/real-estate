"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import { primaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// Asked once, after the first sign-in. It only sets a default: the role is asked
// again for each listing, and can be changed in settings.
const CHOICES = [
  {
    key: "BUYER",
    stored: "OWNER", // there is no buyer role; they can still list their own property
    label: "I'm looking for a property",
    help: "Search, save what you like and contact sellers. You can still list your own property any time.",
  },
  {
    key: "OWNER",
    stored: "OWNER",
    label: "I want to sell or rent my own property",
    help: "List your own flat, house or plot. No registration needed.",
  },
  {
    key: "BUILDER",
    stored: "BUILDER",
    label: "I'm a builder or developer",
    help: "Add your projects and list units in them. A project needs its RERA registration number.",
  },
  {
    key: "BROKER",
    stored: "BROKER",
    label: "I'm a broker or dealer",
    help: "List on behalf of owners and builders. A RERA agent number is needed for sale listings.",
  },
];

const Welcome = () => {
  const router = useRouter();
  const [choice, setChoice] = useState("BUYER");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const picked = CHOICES.find((option) => option.key === choice);
    if (!picked) return;
    setSaving(true);
    try {
      await api.patch("/auth/profile", { accountType: picked.stored });
      router.replace("/");
    } catch (error) {
      errorToast(apiMessage(error));
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 lg:py-16">
      <h1 className="font-display text-[32px] leading-tight lg:text-[40px]">How will you use this site?</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        It only decides what we show you first. You can change it later in settings.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <fieldset>
          <legend className="sr-only">Choose what describes you</legend>
          <div className="space-y-3">
            {CHOICES.map((option) => {
              const selected = choice === option.key;
              return (
                <label
                  key={option.key}
                  className={`flex cursor-pointer gap-3 rounded-xl p-4 ring-1 transition-colors ${
                    selected ? "bg-accent-soft ring-2 ring-accent" : "bg-panel ring-line hover:ring-accent/40"
                  } has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-accent`}
                >
                  <input
                    type="radio"
                    name="choice"
                    value={option.key}
                    checked={selected}
                    onChange={() => setChoice(option.key)}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent"
                  />
                  <span>
                    <span className="block text-[15px] font-semibold">{option.label}</span>
                    <span className="mt-1 block text-[13px] leading-snug text-muted">{option.help}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "Saving…" : "Continue"}
          </button>
          {/* Never a wall: someone who just wants to look around can pass. */}
          <button
            type="button"
            onClick={() => router.replace("/")}
            disabled={saving}
            className="text-[14px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
          >
            Skip for now
          </button>
        </div>
      </form>
    </main>
  );
};

export default Welcome;
