import { createFileRoute } from "@tanstack/react-router";

import { ChildAttendanceScreen } from "../-screens/parent/child-attendance-screen";

/** PAR-03 */
export const Route = createFileRoute("/prototype/sige/_shell/portal-padres/asistencia")({
  component: ChildAttendanceScreen,
});
