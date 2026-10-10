import { createFileRoute } from "@tanstack/react-router";

import { EnrollmentFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/matriculas/$id/editar")({
  component: EditEnrollmentRoute,
});

function EditEnrollmentRoute() {
  const { id } = Route.useParams();
  return <EnrollmentFormPage enrollmentId={id} />;
}
