import { createFileRoute } from "@tanstack/react-router";

import { ObservationDetailScreen } from "../-screens/observations/observation-detail-screen";

/** OBS-02 */
export const Route = createFileRoute("/prototype/sige/_shell/observaciones/detalle")({
  component: ObservationDetailScreen,
});
