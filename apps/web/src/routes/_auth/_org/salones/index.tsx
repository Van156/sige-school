import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  ClassroomsPage,
  classroomSearchDefaults,
  classroomSearchSchema,
} from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/salones/")({
  validateSearch: classroomSearchSchema,
  search: { middlewares: [stripSearchParams(classroomSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <ClassroomsPage search={Route.useSearch()} />;
}
