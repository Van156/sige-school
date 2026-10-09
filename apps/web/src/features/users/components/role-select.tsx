import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";

import { roleKindLabel } from "@/shared/lib/role-label";

import { ASSIGNABLE_ROLES, type AssignableRole } from "../lib/user-roles";

/**
 * Select of assignable roles (sige/03 §5.6, USR-02 "Rol *"). Presentational and controlled: an
 * empty `value` shows `placeholder`. `roles` narrows the options, e.g. when a list filter
 * preselects one.
 */
export default function RoleSelect({
  id,
  value,
  onValueChange,
  roles = ASSIGNABLE_ROLES,
  placeholder = "Selecciona un rol",
  disabled,
  invalid,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: AssignableRole | "";
  onValueChange: (role: AssignableRole | "") => void;
  roles?: readonly AssignableRole[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
}) {
  return (
    <NativeSelect
      id={id}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      value={value}
      onChange={(event) => onValueChange(event.target.value as AssignableRole | "")}
    >
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {roles.map((role) => (
        <NativeSelectOption key={role} value={role}>
          {roleKindLabel(role)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
