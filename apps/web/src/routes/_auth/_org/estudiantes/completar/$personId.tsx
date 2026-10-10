import { createFileRoute } from "@tanstack/react-router";

import { StudentFormPage } from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/completar/$personId")({
  component: CompleteStudentRoute,
});

function CompleteStudentRoute() {
  const { personId } = Route.useParams();
  return <StudentFormPage target={{ mode: "complete", personId }} />;
}
