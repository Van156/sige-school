import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import type { ReactNode } from "react";

import type { StudentDetail } from "../types";
import GuardianCard from "./guardian-card";
import ProfileDetails from "./profile-details";

export type StudentGuardians = Pick<
  StudentDetail,
  "guardianName" | "guardianPhone" | "guardianEmail" | "guardians"
>;

/**
 * STU-02 "Acudientes" tab (sige/05 §5.2): the "Acudiente Principal" contact stored on the profile
 * (no account), then one `GuardianCard` per linked guardian account. Read-only: `manage` renders
 * in the header (the STU-04 "Gestionar" link). Presentational.
 */
export default function StudentGuardiansTab({
  student,
  manage,
}: {
  student: StudentGuardians;
  manage?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold">Información de Acudientes</CardTitle>
        {manage}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <section
          aria-label="Acudiente Principal"
          className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
        >
          <span className="text-sm font-medium">Acudiente Principal</span>
          <ProfileDetails
            className="sm:grid-cols-3"
            items={[
              { label: "Nombre", value: student.guardianName },
              { label: "Teléfono", value: student.guardianPhone },
              { label: "Email", value: student.guardianEmail },
            ]}
          />
        </section>
        {student.guardians.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No hay acudientes vinculados con cuenta de usuario.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {student.guardians.map((guardian) => (
              <li key={guardian.guardianPersonId}>
                <GuardianCard guardian={guardian} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
