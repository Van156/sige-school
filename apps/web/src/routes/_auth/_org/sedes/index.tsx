import { createFileRoute } from "@tanstack/react-router";

import { CampusesPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/sedes/")({
  component: CampusesPage,
});
