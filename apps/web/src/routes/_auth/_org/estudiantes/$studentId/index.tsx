import { createFileRoute } from "@tanstack/react-router";

import { StudentProfilePage } from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/$studentId/")({
  component: StudentProfileRoute,
});

function StudentProfileRoute() {
  const { studentId } = Route.useParams();
  return <StudentProfilePage studentId={studentId} />;
}
