import type { ReactNode } from "react";
import type { Option } from "@/lib/listing";
import { inputClass, labelClass } from "@/lib/ui";

type FieldProps = {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

// A label, its input, and an optional hint or error underneath.
export const Field = ({ id, label, optional, hint, error, children }: FieldProps) => (
  <div>
    <label htmlFor={id} className={labelClass}>
      {label}
      {optional && <span className="font-normal text-muted/70"> (optional)</span>}
    </label>
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
  <select id={id} name={id} value={value} onChange={onChange} className={inputClass}>
    <option value="">Select</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);
