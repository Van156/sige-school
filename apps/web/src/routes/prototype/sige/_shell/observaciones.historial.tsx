import { createFileRoute } from "@tanstack/react-router";

import { StudentObservationsScreen } from "../-screens/observations/student-observations-screen";

/** OBS-05 */
export const Route = createFileRoute("/prototype/sige/_shell/observaciones/historial")({
  component: StudentObservationsScreen,
});
