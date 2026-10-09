import { createFileRoute } from "@tanstack/react-router";

import { PeriodsPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/periodos/")({
  component: PeriodsPage,
});
