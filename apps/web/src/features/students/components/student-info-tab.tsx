import { Badge } from "@base-template/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";

import { birthDateLabel, genderLabel } from "../lib/student-profile";
import type { StudentDetail } from "../types";
import ProfileDetails from "./profile-details";

export type StudentInfo = Pick<
  StudentDetail,
  | "campusName"
  | "courseName"
  | "birthDate"
  | "gender"
  | "bloodType"
  | "address"
  | "neighborhood"
  | "stratum"
  | "eps"
>;

/**
 * STU-02 "Información" tab (sige/05 §5.2): "Información Académica" and "Información de Contacto
 * y Salud". Health and socio-economic fields are shown to every reader, teachers included
 * (OQ-STU-2 default, D6). Presentational.
 */
export default function StudentInfoTab({ student }: { student: StudentInfo }) {
  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Información Académica</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileDetails
            items={[
              { label: "Sede", value: student.campusName },
              {
                label: "Curso / Grado",
                value:
                  student.courseName === null ? (
                    <span className="text-muted-foreground">Sin curso asignado</span>
                  ) : (
                    <Badge variant="outline">{student.courseName}</Badge>
                  ),
              },
              { label: "Fecha de Nacimiento", value: birthDateLabel(student.birthDate) },
              { label: "Género", value: genderLabel(student.gender) },
              { label: "Tipo de Sangre", value: student.bloodType },
            ]}
          />
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Información de Contacto y Salud</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileDetails
            items={[
              { label: "Dirección de Residencia", value: student.address },
              { label: "Barrio / Sector", value: student.neighborhood },
              { label: "Estrato", value: student.stratum },
              { label: "EPS", value: student.eps },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
