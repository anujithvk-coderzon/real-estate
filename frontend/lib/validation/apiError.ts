import { isAxiosError } from "axios";

// Schema keys are database/column names. Show the label the form uses.
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  listingType: "Listing for",
  propertyType: "Property type",
  postedBy: "You are the",
  price: "Price",
  securityDeposit: "Security deposit",
  maintenance: "Monthly maintenance",
  areaValue: "Area",
  areaUnit: "Unit of measurement",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  balconies: "Balconies",
  furnishing: "Furnishing",
  floorNumber: "Floor number",
  totalFloors: "Total floors",
  propertyStatus: "Construction status",
  availableFrom: "Available from",
  addressLine: "Property name or number",
  landmark: "Landmark",
  locality: "Locality or street",
  city: "City or town",
  district: "District",
  state: "State",
  pincode: "Pincode",
  latitude: "Location",
  longitude: "Location",
  contactName: "Contact name",
  contactPhone: "Contact phone",
  name: "Name",
  email: "Email",
  password: "Password",
};

export const apiMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    const data = error.response?.data;

    if (data?.errors?.length) {
      const first = data.errors[0];
      const label = FIELD_LABELS[first.field] ?? first.field;
      return `${label}: ${first.message}`;
    }

    if (!error.response) return "Cannot reach the server. Check your connection.";

    return data?.message ?? "Something went wrong";
  }

  return "Something went wrong";
};
