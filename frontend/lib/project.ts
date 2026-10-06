import type { Option } from "@/lib/listing";

// A builder's project: one building or layout, holding the RERA number
// that every flat sold in it inherits.

export const PROJECT_STATUS: Option[] = [
  { value: "UPCOMING", label: "Upcoming" },
  { value: "ONGOING", label: "Under construction" },
  { value: "COMPLETED", label: "Completed" },
];

export type ProjectFormData = {
  name: string;
  status: string;
  propertyType: string;
  description: string;
  totalUnits: string;
  minPrice: string;
  maxPrice: string;
  startedAt: string;
  handoverAt: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  reraNumber: string;
  reraState: string;
  isReraExempt: boolean;
  exemptReason: string;
};

export const emptyProject: ProjectFormData = {
  name: "",
  status: "",
  propertyType: "",
  description: "",
  totalUnits: "",
  minPrice: "",
  maxPrice: "",
  startedAt: "",
  handoverAt: "",
  locality: "",
  city: "",
  district: "",
  state: "Kerala",
  pincode: "",
  reraNumber: "",
  reraState: "Kerala",
  isReraExempt: false,
  exemptReason: "",
};

// RERA registration is compulsory above this many units, so the exemption is not
// offered: the law decides, not the builder.
export const RERA_EXEMPT_MAX_UNITS = 8;

export const mustRegisterWithRera = (totalUnits: string) =>
  Number(totalUnits) > RERA_EXEMPT_MAX_UNITS;

// What the form must have before it can be sent. Returns the problems, in order.
export const projectProblems = (data: ProjectFormData) => {
  const problems: string[] = [];
  if (data.name.trim().length < 3) problems.push("Project name");
  if (!data.status) problems.push("Stage");
  if (!data.locality.trim()) problems.push("Locality");
  if (!data.city.trim()) problems.push("City");
  if (!data.district.trim()) problems.push("District");
  if (!/^\d{6}$/.test(data.pincode)) problems.push("6-digit pincode");

  // Over 8 units the project must be registered; otherwise it is registered or
  // explicitly exempt with a reason.
  if (mustRegisterWithRera(data.totalUnits)) {
    if (data.reraNumber.trim().length < 5) {
      problems.push(`RERA registration number (required above ${RERA_EXEMPT_MAX_UNITS} units)`);
    }
  } else if (data.isReraExempt) {
    if (data.exemptReason.trim().length < 5) problems.push("Reason for the exemption");
  } else if (data.reraNumber.trim().length < 5) {
    problems.push("RERA registration number");
  }

  if (data.minPrice && data.maxPrice && Number(data.maxPrice) < Number(data.minPrice)) {
    problems.push("Price range (the highest must not be below the lowest)");
  }
  if (data.startedAt && data.handoverAt && data.handoverAt < data.startedAt) {
    problems.push("Handover date (it cannot be before the start)");
  }
  return problems;
};

// Numbers and dates go as numbers and dates; empty fields are left out entirely.
export const buildProjectPayload = (data: ProjectFormData) => ({
  name: data.name.trim(),
  status: data.status,
  ...(data.propertyType && { propertyType: data.propertyType }),
  ...(data.description.trim() && { description: data.description.trim() }),
  ...(data.totalUnits && { totalUnits: Number(data.totalUnits) }),
  ...(data.minPrice && { minPrice: Number(data.minPrice) }),
  ...(data.maxPrice && { maxPrice: Number(data.maxPrice) }),
  ...(data.startedAt && { startedAt: data.startedAt }),
  ...(data.handoverAt && { handoverAt: data.handoverAt }),
  locality: data.locality.trim(),
  city: data.city.trim(),
  district: data.district.trim(),
  state: data.state.trim(),
  pincode: data.pincode,
  isReraExempt: data.isReraExempt && !mustRegisterWithRera(data.totalUnits),
  ...(data.isReraExempt && !mustRegisterWithRera(data.totalUnits)
    ? { exemptReason: data.exemptReason.trim() }
    : { reraNumber: data.reraNumber.trim(), reraState: data.reraState }),
});

// What GET /project/single/:id returns, as far as these pages care.
export type ProjectDetail = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  status: string;
  propertyType?: string | null;
  totalUnits?: number | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  startedAt?: string | null;
  handoverAt?: string | null;
  locality: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  reraNumber?: string | null;
  reraState?: string | null;
  reraStatus: string;
  isReraExempt: boolean;
  exemptReason?: string | null;
  images: { id: string; path: string; position: number }[];
  listingCount: number;
  createdAt: string;
};

// Dates arrive as timestamps; a date input wants "2026-03-01".
const asDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");

export const projectToFormData = (project: ProjectDetail): ProjectFormData => ({
  name: project.name,
  status: project.status,
  propertyType: project.propertyType ?? "",
  description: project.description ?? "",
  totalUnits: project.totalUnits?.toString() ?? "",
  minPrice: project.minPrice?.toString() ?? "",
  maxPrice: project.maxPrice?.toString() ?? "",
  startedAt: asDateInput(project.startedAt),
  handoverAt: asDateInput(project.handoverAt),
  locality: project.locality,
  city: project.city,
  district: project.district,
  state: project.state,
  pincode: project.pincode,
  reraNumber: project.reraNumber ?? "",
  reraState: project.reraState ?? "Kerala",
  isReraExempt: project.isReraExempt,
  exemptReason: project.exemptReason ?? "",
});
