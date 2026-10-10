import { createFileRoute } from "@tanstack/react-router";

import { AssignmentFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/asignaciones/nueva")({
  component: () => <AssignmentFormPage />,
});
