import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { CoursesPage, courseSearchDefaults, courseSearchSchema } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/cursos/")({
  validateSearch: courseSearchSchema,
  search: { middlewares: [stripSearchParams(courseSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <CoursesPage search={Route.useSearch()} />;
}
