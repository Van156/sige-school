import { createFileRoute } from "@tanstack/react-router";

import { ClassroomFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/salones/nuevo")({
  component: () => <ClassroomFormPage />,
});
