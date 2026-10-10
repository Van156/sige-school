import { createFileRoute } from "@tanstack/react-router";

import { AssignmentFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/asignaciones/$id/editar")({
  component: EditAssignmentRoute,
});

function EditAssignmentRoute() {
  const { id } = Route.useParams();
  return <AssignmentFormPage assignmentId={id} />;
}
