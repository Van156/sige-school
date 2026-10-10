import { createFileRoute } from "@tanstack/react-router";

import { EnrollmentFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/matriculas/nueva")({
  component: () => <EnrollmentFormPage />,
});
