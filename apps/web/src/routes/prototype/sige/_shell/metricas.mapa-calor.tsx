import { createFileRoute } from "@tanstack/react-router";

import { HeatmapScreen } from "../-screens/metrics/heatmap-screen";

/** MET-02 */
export const Route = createFileRoute("/prototype/sige/_shell/metricas/mapa-calor")({
  component: HeatmapScreen,
});
