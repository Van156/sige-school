import { createFileRoute } from "@tanstack/react-router";

import { SubjectsPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/asignaturas/")({
  component: SubjectsPage,
});
