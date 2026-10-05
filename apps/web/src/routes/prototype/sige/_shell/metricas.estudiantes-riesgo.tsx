import { createFileRoute } from "@tanstack/react-router";

import { RiskStudentsScreen } from "../-screens/metrics/risk-students-screen";

/** MET-07 */
export const Route = createFileRoute("/prototype/sige/_shell/metricas/estudiantes-riesgo")({
  component: RiskStudentsScreen,
});
