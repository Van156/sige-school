import { createFileRoute } from "@tanstack/react-router";

import { ClassroomFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/salones/$id/editar")({
  component: EditClassroomRoute,
});

function EditClassroomRoute() {
  const { id } = Route.useParams();
  return <ClassroomFormPage classroomId={id} />;
}
