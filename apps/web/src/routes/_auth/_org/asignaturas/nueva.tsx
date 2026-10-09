import { createFileRoute } from "@tanstack/react-router";

import { SubjectFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/asignaturas/nueva")({
  component: () => <SubjectFormPage />,
});
