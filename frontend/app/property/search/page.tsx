import { Suspense } from "react";
import PublicFrame from "@/components/public/PublicFrame";
import SearchResults from "@/components/public/SearchResults";

// Route for /property/search. All the work happens in SearchResults.
// Suspense is required by Next.js because SearchResults reads the URL (useSearchParams).
export default function PropertySearchPage() {
  return (
    <PublicFrame>
      <Suspense>
        <SearchResults />
      </Suspense>
    </PublicFrame>
  );
}
