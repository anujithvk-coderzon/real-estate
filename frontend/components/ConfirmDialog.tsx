"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { dangerButton, secondaryButton } from "@/lib/ui";

type Props = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// A modal that asks the user to confirm a destructive action.
// The native <dialog> opened with showModal() dims the page, keeps keyboard
// focus inside, closes on Esc, and is announced to screen readers.
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel,
  busyLabel,
  busy = false,
  onConfirm,
  onCancel,
}: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const cancel = () => {
    if (!busy) onCancel();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-dialog-title"
      // Esc: let the parent decide, so its state stays in sync.
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      // A click on the dimmed backdrop lands on the <dialog> itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-xl bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <div className="p-6">
        <h2 id="confirm-dialog-title" className="text-[18px] font-semibold tracking-tight">
          {title}
        </h2>
        <div className="mt-2 text-[15px] leading-relaxed text-muted">{message}</div>

        <div className="mt-6 flex justify-end gap-2">
          {/* Cancel gets focus first, so pressing Enter by habit is safe. */}
          <button type="button" autoFocus onClick={cancel} disabled={busy} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={dangerButton}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default ConfirmDialog;
