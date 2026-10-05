import { createFileRoute } from "@tanstack/react-router";

import { ParentPortalScreen } from "../-screens/parent/parent-portal-screen";

/** PAR-01 */
export const Route = createFileRoute("/prototype/sige/_shell/portal-padres/")({
  component: ParentPortalScreen,
});
