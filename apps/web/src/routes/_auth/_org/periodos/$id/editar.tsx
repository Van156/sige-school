import { createFileRoute } from "@tanstack/react-router";

import { PeriodFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/periodos/$id/editar")({
  component: EditPeriodRoute,
});

function EditPeriodRoute() {
  const { id } = Route.useParams();
  return <PeriodFormPage periodId={id} />;
}
