import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";

import type { StudentDetail } from "../types";
import ProfileDetails from "./profile-details";

export type StudentIdentity = Pick<StudentDetail, "username" | "email" | "phone">;

/**
 * STU-02 "Identidad" (sige/05 §5.2): the login of the student ("Usuario", "Email", "Teléfono",
 * "N/A" when empty). Name, document and status are in the `StudentStrip` above. Presentational.
 */
export default function StudentIdentityCard({ student }: { student: StudentIdentity }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Identidad</CardTitle>
      </CardHeader>
      <CardContent>
        <ProfileDetails
          className="sm:grid-cols-1"
          items={[
            { label: "Usuario", value: student.username, mono: true },
            { label: "Email", value: student.email },
            { label: "Teléfono", value: student.phone },
          ]}
        />
      </CardContent>
    </Card>
  );
}
