import { createFileRoute } from "@tanstack/react-router";

import { PeriodFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/periodos/nuevo")({
  component: () => <PeriodFormPage />,
});
