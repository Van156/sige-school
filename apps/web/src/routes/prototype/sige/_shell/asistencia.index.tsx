import { createFileRoute } from "@tanstack/react-router";

import { TakeAttendanceScreen } from "../-screens/attendance/take-attendance-screen";

/** ATT-01 */
export const Route = createFileRoute("/prototype/sige/_shell/asistencia/")({
  component: TakeAttendanceScreen,
});
