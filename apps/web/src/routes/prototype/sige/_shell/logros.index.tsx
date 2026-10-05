import { createFileRoute } from "@tanstack/react-router";

import { AchievementsScreen } from "../-screens/achievements/achievements-screen";

/** ACH-01 */
export const Route = createFileRoute("/prototype/sige/_shell/logros/")({
  component: AchievementsScreen,
});
