import { createFileRoute } from "@tanstack/react-router";

import { ScheduleGeneratePage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/horarios/generar")({
  component: () => <ScheduleGeneratePage />,
});
