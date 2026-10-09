import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";

import {
  PLATFORM_ROLE_OPTIONS,
  platformRoleOptionText,
  type PlatformRoleOption,
} from "../lib/platform-user";

/**
 * INS-05 "Rol del Usuario *" select: the six roles, each with its description ("Administrador"
 * creates an `admin` member). Presentational and controlled.
 */
export default function PlatformRoleSelect({
  id,
  value,
  onValueChange,
  invalid,
  "aria-describedby": describedBy,
}: {
  id?: string;
  value: string;
  onValueChange: (role: PlatformRoleOption["value"]) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <NativeSelect
      id={id}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      value={value}
      onChange={(event) => onValueChange(event.target.value as PlatformRoleOption["value"])}
    >
      {PLATFORM_ROLE_OPTIONS.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {platformRoleOptionText(option)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
