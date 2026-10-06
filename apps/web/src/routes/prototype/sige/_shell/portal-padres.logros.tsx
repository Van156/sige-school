import { createFileRoute } from "@tanstack/react-router";

import { ChildAchievementsScreen } from "../-screens/parent/child-achievements-screen";

/** PAR-06 */
export const Route = createFileRoute("/prototype/sige/_shell/portal-padres/logros")({
  component: ChildAchievementsScreen,
});
