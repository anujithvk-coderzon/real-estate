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

// Coordinates → only the state, district and town, for the listing forms.
// The property name, locality and pincode are the seller's own words; a pin
// dropped a few metres off would otherwise overwrite them with a neighbour's.
export const placeFromPin = async (location: LngLat) => {
  const { city, district, state } = await addressFromPin(location);
  return { city, district, state };
};

// Address fields → coordinates, or null when nothing matches.
//
// Only the town, district and state are sent. The locality and pincode are
// optional and typed freely, so a misspelt street or a wrong pincode made
// Nominatim miss a town it would otherwise have found.
export const pinFromAddress = async (data: ListingFormData): Promise<LngLat | null> => {
  const response = await api.get("/list/details/geocode", {
    params: {
      city: data.city,
      // The district is the rung the server falls back to when the town is
      // misspelt or simply not on the map. Without it the ladder skips
      // straight from the town to the whole state.
      district: data.district,
      state: data.state,
    },
  });
  const result = response.data.response;
  return result ? [result.lon, result.lat] : null;
};
