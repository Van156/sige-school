import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { OfferingsPage, offeringSearchDefaults, offeringSearchSchema } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/materias-por-grado/")({
  validateSearch: offeringSearchSchema,
  search: { middlewares: [stripSearchParams(offeringSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <OfferingsPage search={Route.useSearch()} />;
}
