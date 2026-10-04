import { createFileRoute } from "@tanstack/react-router";

import { AttendanceReportScreen } from "../-screens/attendance/attendance-report-screen";

/** ATT-04 */
export const Route = createFileRoute("/prototype/sige/_shell/asistencia/reporte")({
  component: AttendanceReportScreen,
});
