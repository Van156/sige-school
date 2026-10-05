import { createFileRoute } from "@tanstack/react-router";

import { ObservationsScreen } from "../-screens/observations/observations-screen";

/** OBS-01 */
export const Route = createFileRoute("/prototype/sige/_shell/observaciones/")({
  component: ObservationsScreen,
});
