import { createFileRoute } from "@tanstack/react-router";

import { LevelsPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/niveles/")({
  component: LevelsPage,
});
