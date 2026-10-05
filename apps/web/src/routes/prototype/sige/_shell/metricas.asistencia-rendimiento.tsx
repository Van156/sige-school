import { createFileRoute } from "@tanstack/react-router";

import { AttendancePerformanceScreen } from "../-screens/metrics/attendance-performance-screen";

/** MET-06 */
export const Route = createFileRoute("/prototype/sige/_shell/metricas/asistencia-rendimiento")({
  component: AttendancePerformanceScreen,
});
