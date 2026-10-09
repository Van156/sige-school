import { createFileRoute } from "@tanstack/react-router";

import { CriterionFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/criterios/$id/editar")({
  component: EditCriterionRoute,
});

function EditCriterionRoute() {
  const { id } = Route.useParams();
  return <CriterionFormPage criterionId={id} />;
}
