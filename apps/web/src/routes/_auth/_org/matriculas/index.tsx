import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  EnrollmentsPage,
  enrollmentSearchDefaults,
  enrollmentSearchSchema,
} from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/matriculas/")({
  validateSearch: enrollmentSearchSchema,
  search: { middlewares: [stripSearchParams(enrollmentSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <EnrollmentsPage search={Route.useSearch()} />;
}
