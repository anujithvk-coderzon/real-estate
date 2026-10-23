import { toast } from "sonner";

// Shape only. Colour is left to the Toaster's richColors, which paints a
// success toast green and an error toast red.
//
// It used to set background, colour and border from --color-rail*, tokens that
// the palette change deleted. An undefined var() with no fallback makes the
// whole declaration invalid at computed-value time, so background-color fell
// back to its initial value — transparent — and the toast had no fill at all.
// It also won the cascade while doing it, which is why richColors could not
// paint over it. A var() that must not fail needs a fallback, or no var() here.
const toastStyle = {
  borderRadius: "12px",
  padding: "14px 18px",
  fontSize: "14px",
  fontWeight: "500",
  // The app's shadow colour: a purple-black cast from --color-ink, matching
  // cards and the contact panel. The old one was a teal-black left behind by
  // the same palette change.
  boxShadow: "0 10px 30px -8px rgba(48, 32, 68, 0.3)",
};

export const successToast = (message: string) => {
  toast.success(message, { duration: 3000, style: toastStyle });
};

export const errorToast = (message: string) => {
  toast.error(message, { duration: 4000, style: toastStyle });
};
