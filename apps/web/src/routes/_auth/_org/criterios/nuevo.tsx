import { createFileRoute } from "@tanstack/react-router";

import { CriterionFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/criterios/nuevo")({
  component: () => <CriterionFormPage />,
});
