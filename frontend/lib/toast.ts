import { toast } from "sonner";

// Toasts use the sidebar colours, so they match the rest of the app.
const toastStyle = {
  borderRadius: "12px",
  background: "var(--color-rail)",
  color: "var(--color-rail-ink)",
  border: "1px solid var(--color-rail-line)",
  padding: "14px 18px",
  fontSize: "14px",
  fontWeight: "500",
  boxShadow: "0 10px 30px rgba(13, 42, 36, 0.25)",
};

export const successToast = (message: string) => {
  toast.success(message, { duration: 3000, style: toastStyle });
};

export const errorToast = (message: string) => {
  toast.error(message, { duration: 4000, style: toastStyle });
};
