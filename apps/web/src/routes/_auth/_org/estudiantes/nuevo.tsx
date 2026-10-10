import { createFileRoute } from "@tanstack/react-router";

import { StudentFormPage } from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/nuevo")({
  component: NewStudentRoute,
});

function NewStudentRoute() {
  return <StudentFormPage target={{ mode: "create" }} />;
}
