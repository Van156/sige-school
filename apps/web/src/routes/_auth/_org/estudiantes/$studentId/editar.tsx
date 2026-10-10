import { createFileRoute } from "@tanstack/react-router";

import { StudentFormPage } from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/$studentId/editar")({
  component: EditStudentRoute,
});

function EditStudentRoute() {
  const { studentId } = Route.useParams();
  return <StudentFormPage target={{ mode: "edit", studentId }} />;
}
