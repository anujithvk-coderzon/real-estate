import { api } from "@/lib/api";
import type { ListingFormData, LngLat } from "@/lib/types";

type AddressFields = Pick<ListingFormData, "locality" | "city" | "district" | "state" | "pincode">;

// Nominatim returns whichever place names exist near a point, so each field
// takes the most specific name available.
const toAddressFields = (a: Record<string, string | undefined>): AddressFields => ({
  locality: a.hamlet ?? a.quarter ?? a.neighbourhood ?? a.suburb ?? a.road ?? "",
  city: a.city ?? a.town ?? a.municipality ?? a.village ?? "",
  district: a.state_district ?? "",
  state: a.state ?? "",
  pincode: a.postcode ?? "",
});

// Coordinates → address fields.
export const addressFromPin = async ([lng, lat]: LngLat) => {
  const response = await api.get("/list/details/reverse", { params: { lat, lon: lng } });
  return toAddressFields(response.data.response ?? {});
};

// Address fields → coordinates, or null when nothing matches.
export const pinFromAddress = async (data: ListingFormData): Promise<LngLat | null> => {
  const response = await api.get("/list/details/geocode", {
    params: {
      street: data.locality,
      city: data.city,
      state: data.state,
      postalcode: data.pincode,
    },
  });
  const result = response.data.response;
  return result ? [result.lon, result.lat] : null;
};
