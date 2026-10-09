import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  InstitutionsPage,
  institutionSearchDefaults,
  institutionSearchSchema,
} from "@/features/institutions";

export const Route = createFileRoute("/_auth/admin/instituciones/")({
  validateSearch: institutionSearchSchema,
  search: { middlewares: [stripSearchParams(institutionSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <InstitutionsPage search={Route.useSearch()} />;
}
