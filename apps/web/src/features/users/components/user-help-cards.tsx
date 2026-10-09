import { HelpCard } from "@/features/institution";
import { roleKindLabel } from "@/shared/lib/role-label";

import { ASSIGNABLE_ROLES, type AssignableRole } from "../lib/user-roles";

const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  coordinator: "Supervisión académica: ve notas, boletines, métricas y alertas",
  teacher: "Gestiona notas, asistencia y observaciones de sus grupos",
  student: "Consulta sus notas, asistencia y boletines",
  parent: "Portal de padres: ve información de sus acudidos",
  viewer: "Solo lectura: consulta general",
};

/** USR-02 side card "¿Cómo funciona?" (sige/03 §5.2). */
export function UserHowItWorksCard() {
  return (
    <HelpCard title="¿Cómo funciona?">
      <ul className="flex list-disc flex-col gap-1.5 pl-4">
        <li>El username se genera con la inicial del nombre, el apellido y el documento.</li>
        <li>La contraseña inicial es el número de documento.</li>
        <li>En el primer inicio de sesión se obliga a cambiarla.</li>
      </ul>
    </HelpCard>
  );
}

/** USR-02 side card "Roles del Sistema": what each creatable role can do. */
export function UserRolesCard() {
  return (
    <HelpCard title="Roles del Sistema">
      <ul className="flex flex-col gap-1.5">
        {ASSIGNABLE_ROLES.map((role) => (
          <li key={role}>
            <span className="font-medium text-foreground">{roleKindLabel(role)}:</span>{" "}
            {ROLE_DESCRIPTIONS[role]}
          </li>
        ))}
      </ul>
    </HelpCard>
  );
}
