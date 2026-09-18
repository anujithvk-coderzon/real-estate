"use client";

import { Field, Select } from "@/components/form/Field";
import {
  AREA_UNITS,
  FURNISHING,
  POSTED_BY,
  PROPERTY_STATUS,
  SQFT_PER_UNIT,
  clearInapplicableFields,
  floorsInconsistent,
  hasFloorNumber,
  isRental,
  isResidential,
  listingTypeOptions,
  propertyTypeOptions,
} from "@/lib/listing";
import { formatNumber } from "@/lib/format";
import type { ListingFormData } from "@/lib/types";
import { inputClass } from "@/lib/ui";

type Props = {
  data: ListingFormData;
  setData: React.Dispatch<React.SetStateAction<ListingFormData>>;
};

type ChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

const groupTitle = "text-[15px] font-semibold text-ink";
const monoInput = `${inputClass} font-mono`;

// A mouse wheel over a focused number input silently changes its value.
// Blurring it first lets the wheel scroll the page instead.
const blurNumberInputOnWheel = (event: React.WheelEvent) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type === "number") target.blur();
};

const PropertyDetailsForm = ({ data, setData }: Props) => {
  const handleChange = (event: ChangeEvent) => {
    const { name, value, type } = event.target;
    const nextValue = type === "checkbox" ? (event.target as HTMLInputElement).checked : value;
    setData((prev) => clearInapplicableFields({ ...prev, [name]: nextValue }));
  };

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

  const { listingType, propertyType } = data;
  const rental = isRental(listingType);
  const isPlot = propertyType === "PLOT";
  const floorError = floorsInconsistent(data) ? "Cannot be higher than the total floors." : undefined;

  const areaInSqft =
    data.areaUnit !== "SQFT" && Number(data.areaValue) > 0
      ? formatNumber(Math.round(Number(data.areaValue) * SQFT_PER_UNIT[data.areaUnit]))
      : "";

  return (
    <div className="space-y-7" onWheelCapture={blurNumberInputOnWheel}>
      {/* ---------- what is being listed ---------- */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="listingType" label="Listing for">
            <Select
              id="listingType"
              value={listingType}
              options={listingTypeOptions(propertyType)}
              onChange={handleChange}
            />
          </Field>
          <Field id="propertyType" label="Property type">
            <Select
              id="propertyType"
              value={propertyType}
              options={propertyTypeOptions(listingType)}
              onChange={handleChange}
            />
          </Field>
          <Field id="postedBy" label="You are the">
            <Select id="postedBy" value={data.postedBy} options={POSTED_BY} onChange={handleChange} />
          </Field>
        </div>

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
        </Field>

        <Field id="description" label="Description" hint={`${data.description.length}/5000 · at least 30 characters`}>
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
        </Field>
      </div>

      {/* ---------- price ---------- */}
      <div className="space-y-4 border-t border-line pt-6">
        <h3 className={groupTitle}>Price</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="price"
            label={rental ? "Monthly rent (₹)" : "Price (₹)"}
            hint={listingType && (rental ? "Up to ₹10,00,000." : "At least ₹1,00,000.")}
          >
            <input {...numberInput("price", rental ? "18000" : "4500000")} inputMode="decimal" />
          </Field>

          <label className="flex items-center gap-2 self-end pb-2.5 text-[15px] text-ink">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="securityDeposit" label="Security deposit (₹)">
              <input {...numberInput("securityDeposit", "50000")} inputMode="decimal" />
            </Field>
            <Field id="maintenance" label="Monthly maintenance (₹)" optional>
              <input {...numberInput("maintenance", "1500")} inputMode="decimal" />
            </Field>
          </div>
        )}
      </div>

      {/* ---------- area ---------- */}
      <div className="space-y-4 border-t border-line pt-6">
        <h3 className={groupTitle}>Area</h3>

        <div className="max-w-sm">
          <Field id="areaValue" label="Total area" hint={areaInSqft && `About ${areaInSqft} sq ft`}>
            <div className="flex rounded-md border border-line bg-panel focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <input
                {...numberInput("areaValue", data.areaUnit === "ACRE" ? "0.5" : data.areaUnit === "CENT" ? "10" : "1200")}
                step="any"
                inputMode="decimal"
                className="w-full rounded-l-md bg-transparent px-3 py-2 font-mono text-[15px] text-ink placeholder:text-muted/60 focus:outline-none"
              />
              <select
                name="areaUnit"
                aria-label="Unit of measurement"
                value={data.areaUnit}
                onChange={handleChange}
                className="shrink-0 rounded-r-md border-l border-line bg-transparent px-3 text-[15px] text-ink focus:outline-none"
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

      {/* ---------- configuration ---------- */}
      {propertyType === "" ? (
        <p className="border-t border-line pt-6 text-[14px] text-muted">
          Choose a property type to see the remaining questions.
        </p>
      ) : (
        !isPlot && (
          <div className="space-y-4 border-t border-line pt-6">
            <h3 className={groupTitle}>Configuration</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              {isResidential(propertyType) && (
                <Field id="bedrooms" label="Bedrooms">
                  <input {...numberInput("bedrooms", "2")} />
                </Field>
              )}
              <Field id="bathrooms" label="Bathrooms" optional={!isResidential(propertyType)}>
                <input {...numberInput("bathrooms", "2")} />
              </Field>
              {isResidential(propertyType) && (
                <Field id="balconies" label="Balconies" optional>
                  <input {...numberInput("balconies", "1")} />
                </Field>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="furnishing" label="Furnishing" optional>
                <Select id="furnishing" value={data.furnishing} options={FURNISHING} onChange={handleChange} />
              </Field>
              {hasFloorNumber(propertyType) && (
                <Field id="floorNumber" label="Floor number" optional error={floorError}>
                  <input
                    {...numberInput("floorNumber", "3")}
                    aria-invalid={Boolean(floorError)}
                    aria-describedby={floorError && "floorNumber-error"}
                    className={floorError ? `${monoInput} border-warn` : monoInput}
                  />
                </Field>
              )}
              <Field id="totalFloors" label="Total floors" optional>
                <input {...numberInput("totalFloors", "5")} />
              </Field>
            </div>
          </div>
        )
      )}

      {/* ---------- availability ---------- */}
      {(listingType === "SALE" && !isPlot) || rental ? (
        <div className="space-y-4 border-t border-line pt-6">
          <h3 className={groupTitle}>Availability</h3>
          <div className="grid gap-4 sm:grid-cols-2">
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
      <div className="space-y-4 border-t border-line pt-6">
        <h3 className={groupTitle}>Contact for visits</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contactName" label="Name" optional>
            <input
              id="contactName"
              name="contactName"
              value={data.contactName}
              onChange={handleChange}
              placeholder="Who buyers should ask for"
              className={inputClass}
            />
          </Field>
          <Field id="contactPhone" label="Phone" optional>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              inputMode="tel"
              maxLength={10}
              value={data.contactPhone}
              onChange={handleChange}
              placeholder="10-digit mobile number"
              className={monoInput}
            />
          </Field>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailsForm;
