import { createFileRoute } from "@tanstack/react-router";

import { StudentGuardiansPage } from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/$studentId/acudientes")({
  component: StudentGuardiansRoute,
});

function StudentGuardiansRoute() {
  const { studentId } = Route.useParams();
  return <StudentGuardiansPage studentId={studentId} />;
}
