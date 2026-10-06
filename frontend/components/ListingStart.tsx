"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButton } from "@/lib/ui";
import { api } from "@/lib/api";
import { errorToast } from "@/lib/toast";
import { apiMessage } from "@/lib/validation/apiError";

// Real radio inputs keep arrow-key support and screen-reader grouping;
// the card around each one is only styling.
const ROLES = [
  {
    value: "OWNER",
    label: "Owner",
    help: "It's my own property, including one I bought to resell. I'm selling or renting it myself.",
  },
  {
    value: "BUILDER",
    label: "Builder / developer",
    help: "I built the project and sell units in it.",
  },
  {
    value: "BROKER",
    label: "Broker or dealer",
    help: "I'm listing on behalf of the owner or the builder.",
  },
];

const PURPOSES = [
  { value: "SALE", label: "Sale" },
  { value: "RENT", label: "Rent" },
  { value: "PG", label: "PG or hostel" },
];

type Props = {
  // Pre-selects the role from the account's usual one (accountType).
  defaultRole?: string | undefined;
};

// Asked before the create form opens, because these two answers decide what the
// form (and later, the RERA rules) need to ask.
const ListingStart = ({ defaultRole = "OWNER" }: Props) => {
  const [user,setUser]=useState()
  const router = useRouter();
  const [role, setRole] = useState(defaultRole);
  const [purpose, setPurpose] = useState("");
useEffect(()=>{
 const fetchUser=async()=>{
  try {
    const response=await api.get("/auth/me")
    setUser(response.data.user)
  } catch (error) {
    errorToast(apiMessage(error))
  }
 }
 fetchUser()
},[])
console.log(user);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!purpose) return;
    // In the URL, so refresh and Back keep the answers.
    router.push(`/list/create?as=${role}&for=${purpose}`);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 lg:py-14">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight lg:text-[34px]">List a property</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Two quick questions first: they decide what we need to ask you about the property.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        {/* ---------- who ---------- */}
        <fieldset>
          <legend className="text-[17px] font-semibold tracking-tight">Who&apos;s listing this property?</legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ROLES.map((option) => {
              const selected = role === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-xl p-4 ring-1 transition-colors ${
                    selected ? "bg-accent-soft ring-2 ring-accent" : "bg-panel ring-line hover:ring-accent/40"
                  } has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-accent`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selected}
                    onChange={() => setRole(option.value)}
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

        {/* ---------- what for ---------- */}
        <fieldset className="mt-8">
          <legend className="text-[17px] font-semibold tracking-tight">What is it for?</legend>
          <div className="mt-4 flex flex-wrap gap-2">
            {PURPOSES.map((option) => {
              const selected = purpose === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg px-4 py-2.5 text-[15px] font-medium ring-1 transition-colors ${
                    selected ? "bg-accent text-white ring-accent" : "bg-panel text-muted ring-line hover:text-ink"
                  } has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-offset-2`}
                >
                  <input
                    type="radio"
                    name="purpose"
                    value={option.value}
                    checked={selected}
                    onChange={() => setPurpose(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={!purpose}
          title={purpose ? undefined : "Choose sale, rent or PG"}
          className={`mt-8 ${primaryButton}`}
        >
          Continue
        </button>
      </form>
    </main>
  );
};

export default ListingStart;
