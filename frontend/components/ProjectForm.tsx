"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, Select } from "@/components/form/Field";
import { api } from "@/lib/api";
import { PROPERTY_TYPES } from "@/lib/listing";
import {
  buildProjectPayload,
  emptyProject,
  mustRegisterWithRera,
  PROJECT_STATUS,
  projectProblems,
  RERA_EXEMPT_MAX_UNITS,
  type ProjectFormData,
} from "@/lib/project";
import { errorToast, successToast } from "@/lib/toast";
import { inputClass, primaryButton, secondaryButton, sectionTitle } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type ChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

const MAX_DESCRIPTION = 2000;

// Add a project: one building or layout the builder is selling units in.
// The RERA number lives here, so every flat listed in the project inherits it.
type Props = {
  // Editing an existing project; adding a new one when absent.
  projectId?: string;
  initial?: ProjectFormData;
};

const ProjectForm = ({ projectId, initial }: Props) => {
  const router = useRouter();
  const [data, setData] = useState<ProjectFormData>(initial ?? emptyProject);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(projectId);

  const handleChange = (event: ChangeEvent) => {
    const { name, value, type } = event.target;
    const next = type === "checkbox" ? (event.target as HTMLInputElement).checked : value;
    setData((prev) => {
      const updated = { ...prev, [name]: next };
      // Crossing the unit limit removes the exemption, so a reason typed for a
      // smaller project cannot linger next to a number that forbids it.
      if (name === "totalUnits" && mustRegisterWithRera(String(next))) {
        return { ...updated, isReraExempt: false, exemptReason: "" };
      }
      return updated;
    });
  };

  // Above the unit limit the law requires registration, so the exemption disappears.
  const mustRegister = mustRegisterWithRera(data.totalUnits);
  const problems = projectProblems(data);
  const canSave = problems.length === 0 && !saving;

  // "Completed in" reads better than "Handover" once a project is finished.
  const handoverLabel = data.status === "COMPLETED" ? "Completed in" : "Expected handover";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing) {
        const response = await api.patch(`/project/update/${projectId}`, buildProjectPayload(data));
        successToast(response.data.message ?? "Project updated");
        router.push(`/list/my/projects/${projectId}`);
        return;
      }
      const response = await api.post("/project/create", buildProjectPayload(data));
      successToast(response.data.message ?? "Project added");
      // Photos come next, the same way a listing goes to its media step.
      router.push(`/list/my/projects/${response.data.project.id}/photos`);
    } catch (error) {
      errorToast(apiMessage(error));
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:py-12">
      <header>
        <h1 className="font-display text-[32px] leading-tight lg:text-[38px]">
          {editing ? "Edit project" : "Add a project"}
        </h1>
        <p className="mt-1 max-w-prose text-[15px] leading-relaxed text-muted">
          Buyers see this on your profile, and the flats you list in it carry its registration number.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-10">
        {/* ---------- the basics ---------- */}
        <section className="space-y-5">
          <h2 className={sectionTitle}>The basics</h2>

          <Field id="name" label="Project name">
            <input id="name" name="name" maxLength={120} value={data.name} onChange={handleChange} className={inputClass} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="status" label="Stage">
              <Select id="status" value={data.status} options={PROJECT_STATUS} onChange={handleChange} />
            </Field>
            <Field id="propertyType" label="What is it" optional>
              <Select id="propertyType" value={data.propertyType} options={PROPERTY_TYPES} onChange={handleChange} />
            </Field>
          </div>

          <Field id="description" label="About the project" optional hint="What makes it worth a visit.">
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={MAX_DESCRIPTION}
              value={data.description}
              onChange={handleChange}
              className={`${inputClass} resize-y`}
            />
          </Field>
        </section>

        {/* ---------- size, price, dates ---------- */}
        <section className="space-y-5">
          <h2 className={sectionTitle}>Size and timeline</h2>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="totalUnits" label="Total units" optional>
              <input
                id="totalUnits"
                name="totalUnits"
                type="number"
                min={1}
                value={data.totalUnits}
                onChange={handleChange}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field id="minPrice" label="Price from" optional hint="₹">
              <input
                id="minPrice"
                name="minPrice"
                type="number"
                min={0}
                value={data.minPrice}
                onChange={handleChange}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field id="maxPrice" label="Price up to" optional hint="₹">
              <input
                id="maxPrice"
                name="maxPrice"
                type="number"
                min={0}
                value={data.maxPrice}
                onChange={handleChange}
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="startedAt" label="Started" optional>
              <input id="startedAt" name="startedAt" type="date" value={data.startedAt} onChange={handleChange} className={inputClass} />
            </Field>
            <Field id="handoverAt" label={handoverLabel} optional>
              <input id="handoverAt" name="handoverAt" type="date" value={data.handoverAt} onChange={handleChange} className={inputClass} />
            </Field>
          </div>
        </section>

        {/* ---------- where it is ---------- */}
        <section className="space-y-5">
          <h2 className={sectionTitle}>Where it is</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="locality" label="Locality or street">
              <input id="locality" name="locality" value={data.locality} onChange={handleChange} className={inputClass} />
            </Field>
            <Field id="city" label="City or town">
              <input id="city" name="city" value={data.city} onChange={handleChange} className={inputClass} />
            </Field>
            <Field id="district" label="District">
              <input id="district" name="district" value={data.district} onChange={handleChange} className={inputClass} />
            </Field>
            <Field id="state" label="State">
              <input id="state" name="state" value={data.state} onChange={handleChange} className={inputClass} />
            </Field>
            <Field id="pincode" label="Pincode">
              <input
                id="pincode"
                name="pincode"
                inputMode="numeric"
                maxLength={6}
                value={data.pincode}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, pincode: event.target.value.replace(/\D/g, "") }))
                }
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>
        </section>

        {/* ---------- registration ---------- */}
        <section className="space-y-5">
          <h2 className={sectionTitle}>RERA registration</h2>
          <p className="max-w-prose text-[14px] leading-relaxed text-muted">
            A project on more than 500 sq m, or with more than 8 units, must be registered before it is
            advertised. The number is shown on the project page and on every flat listed in it.
          </p>

          {mustRegister && (
            <p className="rounded-md bg-accent-soft px-3.5 py-3 text-[13px] leading-snug text-accent">
              With more than {RERA_EXEMPT_MAX_UNITS} units, registration is compulsory, so the registration
              number is required here.
            </p>
          )}

          {mustRegister || !data.isReraExempt ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="reraNumber" label="Registration number">
                <input
                  id="reraNumber"
                  name="reraNumber"
                  value={data.reraNumber}
                  onChange={(event) => setData((prev) => ({ ...prev, reraNumber: event.target.value.toUpperCase() }))}
                  placeholder="K-RERA/PRJ/…"
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field id="reraState" label="State of registration">
                <input id="reraState" name="reraState" value={data.reraState} onChange={handleChange} className={inputClass} />
              </Field>
            </div>
          ) : (
            <Field
              id="exemptReason"
              label="Why is it exempt?"
              hint="For example: 8 units on 420 sq m, or completed before RERA came into force."
            >
              <input id="exemptReason" name="exemptReason" value={data.exemptReason} onChange={handleChange} className={inputClass} />
            </Field>
          )}

          {!mustRegister && (
            <label className="flex items-start gap-2.5 text-[14px]">
              <input
                type="checkbox"
                name="isReraExempt"
                checked={data.isReraExempt}
                onChange={handleChange}
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span>
                This project is exempt from registration
                <span className="mt-0.5 block text-[13px] text-muted">
                  Only for {RERA_EXEMPT_MAX_UNITS} units or fewer on under 500 sq m. Shown to buyers as a
                  statement by you, in your words.
                </span>
              </span>
            </label>
          )}
        </section>

        {/* ---------- save ---------- */}
        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-muted">
            {problems.length === 0
              ? editing
                ? "Ready to save."
                : "Ready to add."
              : `Still needed: ${problems.join(", ")}.`}
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={!canSave} className={primaryButton}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add project"}
            </button>
            <Link href={editing ? `/list/my/projects/${projectId}` : "/list/my/profile"} className={secondaryButton}>
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </main>
  );
};

export default ProjectForm;
