import { passwordRules } from "@/lib/validation/auth";

// Ticks off each password rule as the user types. Used wherever a new password is chosen.
const PasswordRules = ({ id, value }: { id: string; value: string }) => (
  <ul id={id} className="mt-2.5 grid gap-1 text-[13px] sm:grid-cols-2">
    {passwordRules.map((rule) => {
      const met = rule.test(value);
      return (
        <li key={rule.id} className={met ? "text-accent" : "text-muted"}>
          <span aria-hidden="true">{met ? "✓" : "○"}</span> {rule.label}
          <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
        </li>
      );
    })}
  </ul>
);

export const meetsPasswordRules = (value: string) => passwordRules.every((rule) => rule.test(value));

export default PasswordRules;
