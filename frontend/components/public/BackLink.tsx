"use client";

import { useRouter } from "next/navigation";

// "Go back", meaning the browser's own back, not a link to the home page.
//
// It was a <Link href="/"> reading "All properties", which quietly threw away
// where the visitor came from: somebody who arrived from a search for 3BHKs in
// Kannur with four filters set was returned to an unfiltered home page and had
// to set it all up again.
//
// A button rather than a link, because this is an action and has no
// destination of its own — a link would offer "open in new tab" on something
// that cannot be opened in one.
const BackLink = ({ fallback = "/" }: { fallback?: string }) => {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // A tab opened straight onto this page — from WhatsApp, or a shared
        // link — has nothing behind it, and back would do nothing at all.
        // Then, and only then, the home page is the honest answer.
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="text-[14px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      ← Go back
    </button>
  );
};

export default BackLink;
