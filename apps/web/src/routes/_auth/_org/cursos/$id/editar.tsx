import { createFileRoute } from "@tanstack/react-router";

import { CourseFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/cursos/$id/editar")({
  component: EditCourseRoute,
});

function EditCourseRoute() {
  const { id } = Route.useParams();
  return <CourseFormPage courseId={id} />;
}
