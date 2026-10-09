import { createFileRoute } from "@tanstack/react-router";

import { LevelFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/niveles/nuevo")({
  component: () => <LevelFormPage />,
});
