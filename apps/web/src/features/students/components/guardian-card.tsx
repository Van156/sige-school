import { Badge } from "@base-template/ui/components/badge";

import type { GuardianLink } from "../types";

const EMPTY_VALUE = "N/A";

export type GuardianCardGuardian = Pick<
  GuardianLink,
  "name" | "relationship" | "username" | "phone" | "email"
>;

/**
 * One linked guardian account (sige/05 §5.2 "Acudientes"): name, relationship badge, then
 * "Usuario", "Teléfono" and "Email", "N/A" when empty. Presentational.
 */
export default function GuardianCard({ guardian }: { guardian: GuardianCardGuardian }) {
  const items: { label: string; value: string | null; mono?: boolean }[] = [
    { label: "Usuario", value: guardian.username, mono: true },
    { label: "Teléfono", value: guardian.phone },
    { label: "Email", value: guardian.email },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{guardian.name}</span>
        <Badge variant="info">{guardian.relationship}</Badge>
      </div>
      <dl className="grid gap-2 text-[13px] sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={item.mono && item.value ? "truncate font-mono" : "truncate"}>
              {item.value || EMPTY_VALUE}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
