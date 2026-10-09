import { createFileRoute } from "@tanstack/react-router";

import { CriteriaPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/criterios/")({
  component: CriteriaPage,
});
