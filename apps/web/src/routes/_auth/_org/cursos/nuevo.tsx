import { createFileRoute } from "@tanstack/react-router";

import { CourseFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/cursos/nuevo")({
  component: () => <CourseFormPage />,
});
