import { createFileRoute } from "@tanstack/react-router";

import { TrendsScreen } from "../-screens/metrics/trends-screen";

/** MET-03 */
export const Route = createFileRoute("/prototype/sige/_shell/metricas/tendencias")({
  component: TrendsScreen,
});
