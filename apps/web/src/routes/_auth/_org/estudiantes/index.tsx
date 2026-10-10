import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { StudentsPage, studentSearchDefaults, studentSearchSchema } from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/")({
  validateSearch: studentSearchSchema,
  search: { middlewares: [stripSearchParams(studentSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <StudentsPage search={Route.useSearch()} />;
}
