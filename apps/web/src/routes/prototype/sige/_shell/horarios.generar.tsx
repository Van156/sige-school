import { createFileRoute } from "@tanstack/react-router";

import { ScheduleGenerateScreen } from "../-screens/school/schedule-generate-screen";

/** SCH-12 */
export const Route = createFileRoute("/prototype/sige/_shell/horarios/generar")({
  component: ScheduleGenerateScreen,
});
