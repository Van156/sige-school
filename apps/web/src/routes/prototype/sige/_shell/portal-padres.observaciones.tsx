import { createFileRoute } from "@tanstack/react-router";

import { ChildObservationsScreen } from "../-screens/parent/child-observations-screen";

/** PAR-04 */
export const Route = createFileRoute("/prototype/sige/_shell/portal-padres/observaciones")({
  component: ChildObservationsScreen,
});
