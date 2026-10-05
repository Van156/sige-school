import { createFileRoute } from "@tanstack/react-router";

import { ObservationFormScreen } from "../-screens/observations/observation-form-screen";

/** OBS-03 */
export const Route = createFileRoute("/prototype/sige/_shell/observaciones/formulario")({
  component: ObservationFormScreen,
});
