"use client";

import { useState } from "react";
import { inputClass } from "@/lib/ui";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

// A password input with a Show / Hide toggle.
const PasswordInput = (props: Props) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${inputClass} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 px-3 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
};

export default PasswordInput;
