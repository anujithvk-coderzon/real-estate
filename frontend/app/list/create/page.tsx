import { Suspense } from "react";
import CreateListing from "@/components/CreateListing";

// Suspense is required by Next.js because CreateListing reads the URL (useSearchParams).
export default function CreateListingPage() {
  return (
    <Suspense>
      <CreateListing />
    </Suspense>
  );
}
