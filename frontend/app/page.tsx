import { Suspense } from "react";
import ListAll from "@/components/public/ListAll";
import PublicFrame from "@/components/public/PublicFrame";

// Route for /. Suspense is required by Next.js because ListAll reads the filters
// from the URL (useSearchParams), which a statically prerendered page cannot know.
const page = () => {
  return (
    <PublicFrame>
      <Suspense>
        <ListAll />
      </Suspense>
    </PublicFrame>
  );
};

export default page;
