import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  AssignmentsPage,
  assignmentSearchDefaults,
  assignmentSearchSchema,
} from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/asignaciones/")({
  validateSearch: assignmentSearchSchema,
  search: { middlewares: [stripSearchParams(assignmentSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <AssignmentsPage search={Route.useSearch()} />;
}
