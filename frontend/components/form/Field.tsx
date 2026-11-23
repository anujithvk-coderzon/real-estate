import type { ReactNode } from "react";
import InfoTip from "@/components/form/InfoTip";
import type { Option } from "@/lib/listing";
import { inputClass, labelClass } from "@/lib/ui";

type FieldProps = {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  // The longer "why", behind an i button beside the label.
  info?: ReactNode;
  error?: string;
  children: ReactNode;
};

// A label, its input, and an optional hint or error underneath.
export const Field = ({
  id,
  label,
  optional,
  hint,
  info,
  error,
  children,
}: FieldProps) => (
  <div>
    {/* The button sits beside the label, not inside it: a click inside a
        label also focuses its input, which would open the keyboard on a phone
        just to read the note. */}
    <div className={info ? "mb-2 flex items-center gap-1.5" : "contents"}>
    <label htmlFor={id} className={info ? "block text-[12.5px] font-medium text-muted" : labelClass}>
      {label}
      {optional ? (
        <span className="font-normal text-muted/70"> (optional)</span>
      ) : (
        <>
          {/* The asterisk is decoration: colour and a glyph are no use to a
              screen reader, so the word rides along hidden beside it. */}
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
    {info && <InfoTip label={`About ${label.toLowerCase()}`}>{info}</InfoTip>}
    </div>
    {children}
    {error ? (
      <p id={`${id}-error`} className="mt-1.5 text-[13px] text-warn">
        {error}
      </p>
    ) : (
      hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>
    )}
  </div>
);

type SelectProps = {
  id: string;
  value: string;
  options: Option[];
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

// The id doubles as the field name, so one change handler can update any field.
export const Select = ({ id, value, options, onChange }: SelectProps) => (
  <select
    id={id}
    name={id}
    value={value}
    onChange={onChange}
    className={inputClass}
  >
    <option value="">Select</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);
