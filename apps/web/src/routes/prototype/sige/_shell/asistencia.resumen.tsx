import { createFileRoute } from "@tanstack/react-router";

import { GroupAttendanceScreen } from "../-screens/attendance/group-attendance-screen";

/** ATT-03 */
export const Route = createFileRoute("/prototype/sige/_shell/asistencia/resumen")({
  component: GroupAttendanceScreen,
});
