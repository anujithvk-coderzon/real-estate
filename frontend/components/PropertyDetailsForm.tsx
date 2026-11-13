"use client";

import { useEffect, useState } from "react";
import AmenitiesPicker from "@/components/form/AmenitiesPicker";
import { Field, Select } from "@/components/form/Field";
import { api } from "@/lib/api";
import {
  AREA_UNITS,
  FURNISHING,
  POSTED_BY,
  PROPERTY_STATUS,
  SQFT_PER_UNIT,
  amenityCategoriesFor,
  clearInapplicableFields,
  floorsInconsistent,
  hasFloorNumber,
  isRental,
  isResidential,
  listingTypeOptions,
  propertyTypeOptions,
  suggestTitle,
  suggestDescription,
} from "@/lib/listing";
import { amountInput } from "@/lib/amount";
import { formatNumber } from "@/lib/format";
import type { ListingAmenity, ListingFormData } from "@/lib/types";
import { focusRing, inputClass } from "@/lib/ui";

// The groups this form is made of, in the order they render. The stepped create
// flow asks for a slice at a time; edit and the old single page ask for all of
// them. Naming them here keeps the split in one place rather than in whichever
// screen happens to be rendering.
export const DETAIL_SECTIONS = [
  "type",
  "configuration",
  "areaPrice",
  "location",
  "titleDescription",
  "amenities",
  "availability",
  "contact",
] as const;

export type DetailSection = (typeof DETAIL_SECTIONS)[number];

type Props = {
  data: ListingFormData;
  setData: React.Dispatch<React.SetStateAction<ListingFormData>>;
  // Create flow: the start screen already asked "for sale or rent" and "who are you".
  hideTypeAndRole?: boolean;
  // Which groups to render. Omitted means all of them, so every existing caller
  // keeps working untouched.
  sections?: readonly DetailSection[];
};

type ChangeEvent = React.ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

const groupTitle = "text-[15px] font-semibold text-ink";
const monoInput = `${inputClass} tabular-nums`;

// The three ways a buyer can open a conversation. Keyed by the form field so
// one map renders all three rows and the names cannot drift from the payload.
const CONTACT_CHANNELS = [
  {
    name: "contactPhoneVisibility",
    label: "Phone call",
    hint: "Shows a Call button with your number on it.",
  },
  {
    name: "contactWatsappVisibility",
    label: "WhatsApp",
    hint: "Opens WhatsApp on your number with a first message ready.",
  },
  {
    name: "contactInappVisibility",
    label: "Chat here",
    hint: "Messages arrive in your inbox and your number stays private.",
  },
] as const;

// A mouse wheel over a focused number input silently changes its value.
// Blurring it first lets the wheel scroll the page instead.
const blurNumberInputOnWheel = (event: React.WheelEvent) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type === "number")
    target.blur();
};


// Name and phone, as one piece. They are asked at the top of the create flow,
// beside the property type, because that row has spare width on a laptop and
// because a listing cannot be published without them — better to collect them
// while the seller is fresh than at the bottom of a long form. The edit screen
// keeps them down in the contact group, where its own heading already explains
// them.
const ContactNamePhone = ({
  data,
  handleChange,
}: {
  data: ListingFormData;
  handleChange: (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
}) => (
  <>
    {/* A buyer about to ring a stranger about a house wants to know who they
        are asking for. The account name is not always the right answer — it
        may be a caretaker, a spouse or an agent who shows the property — so it
        is asked rather than assumed. */}
    <Field id="contactName" label="Name">
      <input
        id="contactName"
        name="contactName"
        value={data.contactName}
        onChange={handleChange}
        placeholder="Who buyers should ask for"
        className={inputClass}
      />
    </Field>
    {/* Not marked optional: publishing is refused without it, so calling it
        optional here would be a promise the API breaks. */}
    <Field id="contactPhone" label="Phone">
      <input
        id="contactPhone"
        name="contactPhone"
        type="tel"
        inputMode="numeric"
        maxLength={10}
        value={data.contactPhone}
        onChange={handleChange}
        placeholder="10-digit mobile number"
        className={`${inputClass} tabular-nums tracking-[0.08em]`}
      />
    </Field>
  </>
);

const PropertyDetailsForm = ({
  data,
  setData,
  hideTypeAndRole = false,
  sections = DETAIL_SECTIONS,
}: Props) => {
  const show = (name: DetailSection) => sections.includes(name);
  const [amenities, setAmenities] = useState<ListingAmenity[]>([]);
  // The last draft this form put in the box. While the text still matches it,
  // the seller has not touched it and a newer draft may replace it. The moment
  // they edit a word, it stops matching and we stop offering — their sentences
  // are not ours to overwrite.
  const [lastDraft, setLastDraft] = useState("");

  const suggestedTitle = suggestTitle(data);
  const suggestedDescription = suggestDescription(
    data,
    amenities
      .filter((item) => data.amenityIds.includes(item.id))
      .map((item) => item.name),
  );

  // Only when this instance is actually showing amenities. The stepped flow
  // renders two slices of this form side by side, and without the guard both
  // of them would fetch the same list.
  const wantsAmenities = sections.includes("amenities");

  useEffect(() => {
    if (!wantsAmenities) return;
    api
      .get("/list/amenities")
      .then((response) => setAmenities(response.data.amenities))
      .catch(() => {
        // The rest of the form still works without the amenity list.
      });
  }, [wantsAmenities]);

  const handleChange = (event: ChangeEvent) => {
    const { name, value, type } = event.target;
    const nextValue =
      type === "checkbox" ? (event.target as HTMLInputElement).checked : value;

    setData((prev) => {
      const next = clearInapplicableFields({ ...prev, [name]: nextValue });
      if (name !== "listingType" && name !== "propertyType") return next;

      // Changing the type hides some amenity categories; drop those selections
      // too, so a plot does not keep a "Lift" picked for an apartment.
      const allowed = amenityCategoriesFor(next.listingType, next.propertyType);
      const categoryOf = new Map(
        amenities.map((amenity) => [amenity.id, amenity.category]),
      );
      return {
        ...next,
        amenityIds: next.amenityIds.filter((id) =>
          allowed.includes(categoryOf.get(id) ?? ""),
        ),
      };
    });
  };

  const toggleAmenity = (amenityId: string) =>
    setData((prev) => ({
      ...prev,
      amenityIds: prev.amenityIds.includes(amenityId)
        ? prev.amenityIds.filter((id) => id !== amenityId)
        : [...prev.amenityIds, amenityId],
    }));

  // Props shared by every whole-number input on this form.
  const numberInput = (name: keyof ListingFormData, placeholder: string) => ({
    id: name,
    name,
    type: "number",
    min: 0,
    inputMode: "numeric" as const,
    value: data[name] as string,
    onChange: handleChange,
    placeholder,
    className: monoInput,
  });

  // Rupee amounts, shown grouped as they are typed.
  const moneyInput = (name: keyof ListingFormData, placeholder: string) =>
    amountInput({
      name,
      value: data[name] as string,
      placeholder,
      className: monoInput,
      onValue: (amount) =>
        setData((prev) => clearInapplicableFields({ ...prev, [name]: amount })),
    });

  const { listingType, propertyType } = data;
  const rental = isRental(listingType);
  const isPlot = propertyType === "PLOT";
  const floorError = floorsInconsistent(data)
    ? "Cannot be higher than the total floors."
    : undefined;

  const areaInSqft =
    data.areaUnit !== "SQFT" && Number(data.areaValue) > 0
      ? formatNumber(
          Math.round(Number(data.areaValue) * SQFT_PER_UNIT[data.areaUnit]),
        )
      : "";

  return (
    <div
      className="space-y-7 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0"
      onWheelCapture={blurNumberInputOnWheel}
    >
      {/* ---------- what is being listed ---------- */}
      {show("type") && (
      <div className="space-y-4">
        <div
          className={`grid grid-cols-1 gap-4 ${hideTypeAndRole ? "sm:max-w-sm" : "sm:grid-cols-3"}`}
        >
          {!hideTypeAndRole && (
            <Field id="listingType" label="Listing for">
              <Select
                id="listingType"
                value={listingType}
                options={listingTypeOptions(propertyType)}
                onChange={handleChange}
              />
            </Field>
          )}
          <Field id="propertyType" label="Property type">
            <Select
              id="propertyType"
              value={propertyType}
              options={propertyTypeOptions(listingType)}
              onChange={handleChange}
            />
          </Field>
          {!hideTypeAndRole && (
            <Field id="postedBy" label="You are the">
              <Select
                id="postedBy"
                value={data.postedBy}
                options={POSTED_BY}
                onChange={handleChange}
              />
            </Field>
          )}
        </div>
      </div>

      )}

      {/* ---------- configuration ---------- */}
      {show("configuration") && (propertyType === "" ? (
        <p className="border-t border-line pt-6 text-[14px] text-muted">
          Choose a property type to see the remaining questions.
        </p>
      ) : (
        !isPlot && (
          <div className="space-y-4 border-t border-line pt-6">
            <h3 className={groupTitle}>Configuration</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {isResidential(propertyType) && (
                <Field id="bedrooms" label="Bedrooms">
                  <input {...numberInput("bedrooms", "2")} />
                </Field>
              )}
              <Field
                id="bathrooms"
                label="Bathrooms"
                optional={!isResidential(propertyType)}
              >
                <input {...numberInput("bathrooms", "2")} />
              </Field>
              {isResidential(propertyType) && (
                <Field id="balconies" label="Balconies" optional>
                  <input {...numberInput("balconies", "1")} />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field id="furnishing" label="Furnishing" optional>
                <Select
                  id="furnishing"
                  value={data.furnishing}
                  options={FURNISHING}
                  onChange={handleChange}
                />
              </Field>
              {hasFloorNumber(propertyType) && (
                <Field
                  id="floorNumber"
                  label="Floor number"
                  optional
                  error={floorError}
                >
                  <input
                    {...numberInput("floorNumber", "3")}
                    aria-invalid={Boolean(floorError)}
                    aria-describedby={floorError && "floorNumber-error"}
                    className={
                      floorError ? `${monoInput} border-warn` : monoInput
                    }
                  />
                </Field>
              )}
              <Field id="totalFloors" label="Total floors" optional>
                <input {...numberInput("totalFloors", "5")} />
              </Field>
            </div>
          </div>
        )
      ))}


      {/* ---------- area and price, side by side ---------- */}
      {show("areaPrice") && (
      <div className="grid gap-5 border-t border-line pt-5 sm:pt-6 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-4">
          <h3 className={groupTitle}>Area</h3>

          <div className="max-w-sm">
            <Field
              id="areaValue"
              label="Total area"
              hint={areaInSqft && `About ${areaInSqft} sq ft`}
            >
              <div className="flex rounded-lg border border-line bg-panel focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                <input
                  {...numberInput(
                    "areaValue",
                    data.areaUnit === "ACRE"
                      ? "0.5"
                      : data.areaUnit === "CENT"
                        ? "10"
                        : "1200",
                  )}
                  step="any"
                  inputMode="decimal"
                  // min-w-0: without it the input refuses to shrink below its
                  // intrinsic 20-character width, and the row plus its unit select
                  // needs ~260px inside a 240px card — a sideways-scrolling page.
                  className="w-full min-w-0 rounded-l-md bg-transparent px-3 py-2 tabular-nums text-[16px] text-ink placeholder:text-muted/60 focus:outline-none sm:text-[15px]"
                />
                <select
                  name="areaUnit"
                  aria-label="Unit of measurement"
                  value={data.areaUnit}
                  onChange={handleChange}
                  className="shrink-0 rounded-r-md border-l border-line bg-transparent px-3 text-[16px] text-ink focus:outline-none sm:text-[15px]"
                >
                  {AREA_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className={groupTitle}>Price</h3>

          <div className="max-w-sm space-y-3">
            <Field
              id="price"
              label={rental ? "Monthly rent (₹)" : "Price (₹)"}
              hint={
                listingType &&
                (rental ? "Up to ₹10,00,000." : "At least ₹1,00,000.")
              }
            >
              <input {...moneyInput("price", rental ? "18,000" : "45,00,000")} />
            </Field>

            <label className="flex items-center gap-2 text-[15px] text-ink">
              <input
                name="isNegotiable"
                type="checkbox"
                checked={data.isNegotiable}
                onChange={handleChange}
                className="h-4 w-4 accent-accent"
              />
              Price is negotiable
            </label>
          </div>

          {rental && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="securityDeposit" label="Security deposit (₹)">
                <input {...moneyInput("securityDeposit", "50,000")} />
              </Field>
              <Field id="maintenance" label="Monthly maintenance (₹)" optional>
                <input {...moneyInput("maintenance", "1,500")} />
              </Field>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ---------- where, in words ---------- */}
      {show("location") && (
      <div className="space-y-4 border-t border-line pt-6">
        <h3 className={groupTitle}>Location</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="state" label="State">
            <input id="state" name="state" value={data.state} onChange={handleChange} placeholder="Your state" className={inputClass} />
          </Field>
          <Field id="district" label="District">
            <input id="district" name="district" value={data.district} onChange={handleChange} placeholder="Your district" className={inputClass} />
          </Field>
          <Field id="city" label="City or town">
            <input id="city" name="city" value={data.city} onChange={handleChange} placeholder="Your town or city" className={inputClass} />
          </Field>
        </div>
      </div>
      )}

      {/* ---------- title and description ---------- */}
      {show("titleDescription") && (
      <div className="space-y-4 border-t border-line pt-6">
        <Field id="title" label="Title" hint="At least 10 characters.">
          <input
            id="title"
            name="title"
            maxLength={150}
            value={data.title}
            onChange={handleChange}
            placeholder="2 BHK apartment with covered parking"
            className={inputClass}
          />
          {/* Offered, never applied behind their back: a title that rewrote
              itself as they filled the rest of the form would overwrite words
              they had chosen. Gone once it matches what is in the box. */}
          {suggestedTitle && suggestedTitle !== data.title.trim() && (
            <button
              type="button"
              onClick={() => setData((d) => ({ ...d, title: suggestedTitle }))}
              className={`mt-2 max-w-full truncate rounded-lg bg-accent-soft px-2.5 py-1.5 text-left text-[13px] text-accent transition-colors hover:bg-accent hover:text-white ${focusRing}`}
            >
              Use: {suggestedTitle}
            </button>
          )}
        </Field>

        <Field
          id="description"
          label="Description"
          hint={
            data.description.trim() === ""
              ? "Say what a photograph cannot: water supply, road access, who the neighbours are, and what is within walking distance."
              : `${data.description.length}/5000 · at least 30 characters`
          }
        >
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={5000}
            value={data.description}
            onChange={handleChange}
            placeholder="Condition, water supply, road access, nearby schools and shops."
            className={`${inputClass} resize-y`}
          />
          {suggestedDescription &&
            suggestedDescription.trim() !== data.description.trim() &&
            (data.description.trim() === "" ||
              data.description === lastDraft) && (
            <button
              type="button"
              onClick={() => {
                setData((d) => ({ ...d, description: suggestedDescription }));
                setLastDraft(suggestedDescription);
              }}
              className={`mt-2 rounded-lg bg-accent-soft px-2.5 py-1.5 text-[13px] text-accent transition-colors hover:bg-accent hover:text-white ${focusRing}`}
            >
              {data.description.trim() === ""
                ? "Start with the details I have given"
                : "Update with the details I have given"}
            </button>
          )}
        </Field>
      </div>
      )}

      {/* ---------- amenities ---------- */}
      {show("amenities") && propertyType !== "" && amenities.length > 0 && (
        <div className="space-y-4 border-t border-line pt-6">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className={groupTitle}>
              Amenities{" "}
              <span className="font-normal text-muted">(optional)</span>
            </h3>
            {data.amenityIds.length > 0 && (
              <p className="text-[13px] text-muted">
                {data.amenityIds.length} selected
              </p>
            )}
          </div>
          <AmenitiesPicker
            amenities={amenities}
            categories={amenityCategoriesFor(listingType, propertyType)}
            selected={data.amenityIds}
            onToggle={toggleAmenity}
          />
        </div>
      )}

      {/* ---------- availability ---------- */}
      {show("availability") && ((listingType === "SALE" && !isPlot) || rental) ? (
        <div className="space-y-4 border-t border-line pt-6">
          <h3 className={groupTitle}>Availability</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {listingType === "SALE" && (
              <Field id="propertyStatus" label="Construction status" optional>
                <Select
                  id="propertyStatus"
                  value={data.propertyStatus}
                  options={PROPERTY_STATUS}
                  onChange={handleChange}
                />
              </Field>
            )}
            {rental && (
              <Field id="availableFrom" label="Available from" optional>
                <input
                  id="availableFrom"
                  name="availableFrom"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={data.availableFrom}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>
            )}
          </div>
        </div>
      ) : null}

      {/* ---------- contact ---------- */}
      {show("contact") && (
      <div className="space-y-4 border-t border-line pt-6">
        <h3 className={groupTitle}>Contact for visits</h3>
        <p className="-mt-2 text-[13px] text-muted">
          The phone number is the only way a buyer can reach you &mdash; your
          account email is never shown. A listing cannot be published without
          one.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ContactNamePhone data={data} handleChange={handleChange} />
        </div>

        {/* Which of those channels the listing actually offers. Both phone
            options are greyed out until there is a number to put behind them —
            a Call button on no number is a dead end for the buyer. */}
        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-[14px] font-medium text-ink">
            How buyers can reach you
          </legend>
          <p className="text-[13px] text-muted">
            Turn off anything you would rather not receive. Whatever stays on
            becomes a button on your listing.
          </p>
          <div className="mt-3 space-y-3.5">
            {CONTACT_CHANNELS.map((channel) => {
              const needsPhone = channel.name !== "contactInappVisibility";
              const disabled = needsPhone && data.contactPhone.trim() === "";
              return (
                <label
                  key={channel.name}
                  className={`flex items-start gap-2.5 text-[15px] ${
                    disabled ? "text-muted" : "text-ink"
                  }`}
                >
                  <input
                    name={channel.name}
                    type="checkbox"
                    checked={data[channel.name] && !disabled}
                    disabled={disabled}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 accent-accent"
                  />
                  <span>
                    {channel.label}
                    <span className="block text-[13px] text-muted">
                      {disabled
                        ? "Add a phone number above to offer this."
                        : channel.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {!data.contactPhoneVisibility &&
            !data.contactWatsappVisibility &&
            !data.contactInappVisibility && (
              <p className="mt-3.5 text-[13px] text-danger">
                Leave at least one on, or nobody can answer your listing.
              </p>
            )}
        </fieldset>
      </div>
      )}
    </div>
  );
};

export default PropertyDetailsForm;
