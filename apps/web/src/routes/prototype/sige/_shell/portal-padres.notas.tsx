import { createFileRoute } from "@tanstack/react-router";

import { ChildGradesScreen } from "../-screens/parent/child-grades-screen";

/** PAR-02 */
export const Route = createFileRoute("/prototype/sige/_shell/portal-padres/notas")({
  component: ChildGradesScreen,
});
