import { createFileRoute } from "@tanstack/react-router";

import { SubjectFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/asignaturas/$id/editar")({
  component: EditSubjectRoute,
});

function EditSubjectRoute() {
  const { id } = Route.useParams();
  return <SubjectFormPage subjectId={id} />;
}
