import { createFileRoute } from "@tanstack/react-router";

import { SchedulesPage, scheduleSearchSchema } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/horarios/")({
  validateSearch: scheduleSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  return <SchedulesPage search={Route.useSearch()} />;
}
