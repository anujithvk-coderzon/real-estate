// Money inputs group their digits the Indian way while they are typed, so
// 20000000 reads as 2,00,00,000 instead of being counted zero by zero.
//
// A number input cannot hold commas, so these fields are text inputs: the form
// state keeps plain digits and only the display is grouped.

import type { ChangeEvent } from "react";
import { formatNumber } from "@/lib/format";

// Hundreds of crores is past any real listing, and it stops a stray paste from
// filling the field with forty digits.
const MAX_DIGITS = 12;

export const toAmount = (text: string) =>
  text
    .replace(/\D/g, "")
    // Without this, "007" would show as 7 while the form still held "007".
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_DIGITS);

// Commas shift position as the number grows, so the caret is restored by
// counting digits rather than characters.
const caretAfterDigits = (formatted: string, digits: number) => {
  let seen = 0;
  let position = 0;
  while (position < formatted.length && seen < digits) {
    if (/\d/.test(formatted[position])) seen += 1;
    position += 1;
  }
  return position;
};

type Options = {
  name: string;
  value: string;
  placeholder: string;
  className: string;
  onValue: (amount: string) => void;
};

// Props for an input that shows a grouped amount but reports plain digits, so
// the payload sent to the API stays a number.
export const amountInput = ({ name, value, placeholder, className, onValue }: Options) => ({
  id: name,
  name,
  type: "text" as const,
  inputMode: "numeric" as const,
  autoComplete: "off",
  value: value ? formatNumber(value) : "",
  placeholder,
  className,
  onChange: (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const caret = input.selectionStart ?? input.value.length;
    const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, "").length;
    const amount = toAmount(input.value);

    onValue(amount);

    // The caret can only be placed once React has painted the grouped value.
    requestAnimationFrame(() => {
      const position = caretAfterDigits(amount ? formatNumber(amount) : "", digitsBeforeCaret);
      input.setSelectionRange(position, position);
    });
  },
});
