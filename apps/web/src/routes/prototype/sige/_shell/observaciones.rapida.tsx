import { createFileRoute } from "@tanstack/react-router";

import { QuickObservationScreen } from "../-screens/observations/quick-observation-screen";

/** OBS-04 */
export const Route = createFileRoute("/prototype/sige/_shell/observaciones/rapida")({
  component: QuickObservationScreen,
});
