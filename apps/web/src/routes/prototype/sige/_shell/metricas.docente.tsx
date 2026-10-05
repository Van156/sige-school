import { createFileRoute } from "@tanstack/react-router";

import { TeacherMetricsScreen } from "../-screens/metrics/teacher-metrics-screen";

/** MET-05 */
export const Route = createFileRoute("/prototype/sige/_shell/metricas/docente")({
  component: TeacherMetricsScreen,
});
