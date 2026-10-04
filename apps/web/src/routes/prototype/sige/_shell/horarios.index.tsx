import { createFileRoute } from "@tanstack/react-router";

import { SchedulesScreen } from "../-screens/school/schedules-screen";

/** SCH-11 */
export const Route = createFileRoute("/prototype/sige/_shell/horarios/")({
  component: SchedulesScreen,
});
