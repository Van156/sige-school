import { createFileRoute } from "@tanstack/react-router";

import { TeacherComparisonScreen } from "../-screens/metrics/teacher-comparison-screen";

/** MET-04 */
export const Route = createFileRoute("/prototype/sige/_shell/metricas/comparativa-docentes")({
  component: TeacherComparisonScreen,
});
