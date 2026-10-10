import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import type { ReactNode } from "react";

import { getInitials } from "@/shared/lib/initials";

import type { StudentRow } from "../types";
import StatusBadge from "./status-badge";

export type StudentStripStudent = Pick<
  StudentRow,
  "name" | "documentType" | "documentNumber" | "courseName" | "campusName" | "status"
>;

/**
 * Identity strip of the per-student screens (sige/05 §5.6; GRD-08, ATT-02, OBS-05, ACH-02):
 * initials, name, course, document, campus and status. Presentational: `back` renders above the
 * card (e.g. a "Volver" link) and `actions` in its header.
 */
export default function StudentStrip({
  student,
  back,
  actions,
}: {
  student: StudentStripStudent;
  back?: ReactNode;
  actions?: ReactNode;
}) {
  const card = (
    <Card size="sm">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold">Estudiante</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Avatar size="lg" aria-hidden="true">
          <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-base font-semibold">{student.name}</span>
          <span className="text-[13px] text-muted-foreground">
            Grado:{" "}
            <strong className="font-medium text-foreground">
              {student.courseName ?? "Sin curso"}
            </strong>
            {` | Documento: ${student.documentType} ${student.documentNumber}`}
            {` | Sede: ${student.campusName}`}
          </span>
        </div>
        <StatusBadge status={student.status} />
      </CardContent>
    </Card>
  );
  if (!back) {
    return card;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 print:hidden">{back}</div>
      {card}
    </div>
  );
}
