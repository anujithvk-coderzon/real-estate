"use client";

import { useState } from "react";
import { Field } from "@/components/form/Field";
import { pinFromAddress } from "@/lib/geocode";
import { INDIA_CENTER } from "@/lib/listing";
import { errorToast } from "@/lib/toast";
import type { ListingFormData, LngLat } from "@/lib/types";
import { inputClass, primaryButton, secondaryButton, textButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type Props = {
  data: ListingFormData;
  setData: React.Dispatch<React.SetStateAction<ListingFormData>>;
  // Called with the coordinates to show on the map, and how they were found.
  onLocate: (location: LngLat, source: "address" | "fallback") => void;
  onCancel?: () => void;
};

// Pincodes are digits only; place names never contain digits.
const clean = (name: string, value: string) => {
  if (name === "pincode") return value.replace(/\D/g, "");
  if (["city", "district", "state"].includes(name)) return value.replace(/[^a-zA-Z\s.'-]/g, "");
  return value;
};

const AddressForm = ({ data, setData, onLocate, onCancel }: Props) => {
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setNotFound(false);
    setData((prev) => ({ ...prev, [name]: clean(name, value) }));
  };

  const findOnMap = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    try {
      const location = await pinFromAddress(data);
      if (location) onLocate(location, "address");
      else setNotFound(true);
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const input = (name: keyof ListingFormData, placeholder: string) => ({
    id: name,
    name,
    value: data[name] as string,
    onChange: handleChange,
    placeholder,
    className: inputClass,
  });

  return (
    <form onSubmit={findOnMap} className="mt-5 space-y-4 border-t border-line pt-5">
      <Field id="addressLine" label="Property name or number">
        <input {...input("addressLine", "Green Valley Apartments")} />
      </Field>
      <Field id="landmark" label="Landmark" optional>
        <input {...input("landmark", "Near the metro station")} />
      </Field>
      <Field id="locality" label="Locality or street">
        <input {...input("locality", "Panampilly Nagar, 2nd Cross Road")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="city" label="City or town">
          <input {...input("city", "Kochi")} />
        </Field>
        <Field id="state" label="State">
          <input {...input("state", "Kerala")} />
        </Field>
        <Field id="district" label="District">
          <input {...input("district", "Ernakulam")} />
        </Field>
        <Field id="pincode" label="Pincode">
          <input
            {...input("pincode", "682036")}
            inputMode="numeric"
            maxLength={6}
            className={`${inputClass} font-mono tracking-[0.08em]`}
          />
        </Field>
      </div>

      {notFound && (
        <div role="status" className="rounded-md border border-warn/25 bg-warn/5 px-3.5 py-3">
          <p className="text-[14px] font-medium text-ink">We could not find this address on the map</p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            For better search reach, pin the property exactly on the map.
          </p>
          <button
            type="button"
            onClick={() => {
              setNotFound(false);
              onLocate(INDIA_CENTER, "fallback");
            }}
            className="mt-3 rounded-md bg-warn px-3.5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-warn/90"
          >
            Open map
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={searching} className={notFound ? secondaryButton : primaryButton}>
          {searching ? "Moving pin…" : notFound ? "Search again" : "Move pin to this address"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={textButton}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default AddressForm;
