"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { apiMessage, goodButton, quietButton } from "@/lib/ui";

// Putting a listing back up. Two presses, not a dialog with a written reason:
// taking something down needs a reason because somebody is told it and loses
// their listing over it, while restoring is the benign direction and a form in
// front of it only makes an operator hesitate over the right thing to do.
const RestoreButton = ({
  listingId,
  onDone,
}: {
  listingId: string;
  // The caller decides what to do with the news — refetch, or drop the row.
  onDone: (message: string) => void;
}) => {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const restore = async () => {
    setWorking(true);
    setFailure(null);
    try {
      const { data } = await api.patch(`/admin/listing/activate/${listingId}`);
      onDone(data.message ?? "Listing is back up");
    } catch (error) {
      setFailure(apiMessage(error, "Could not put it back up"));
    } finally {
      setWorking(false);
    }
  };

  if (working)
    return <span className="text-[13px] text-muted">Putting it back…</span>;

  if (confirming)
    return (
      <span className="flex flex-wrap items-center gap-1">
        {failure && (
          <span role="alert" className="text-[12.5px] text-danger">
            {failure}
          </span>
        )}
        <button type="button" onClick={restore} className={goodButton}>
          Yes, put it back up
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={quietButton}
        >
          Cancel
        </button>
      </span>
    );

  return (
    <span className="flex flex-wrap items-center gap-1">
      {failure && (
        <span role="alert" className="text-[12.5px] text-danger">
          {failure}
        </span>
      )}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={goodButton}
      >
        Put it back up
      </button>
    </span>
  );
};

export default RestoreButton;
