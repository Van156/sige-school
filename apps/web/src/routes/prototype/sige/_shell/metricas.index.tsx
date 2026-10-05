import { createFileRoute } from "@tanstack/react-router";

import { InstitutionMetricsScreen } from "../-screens/metrics/institution-metrics-screen";

/** MET-01 */
export const Route = createFileRoute("/prototype/sige/_shell/metricas/")({
  component: InstitutionMetricsScreen,
});
