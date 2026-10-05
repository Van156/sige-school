import { createFileRoute } from "@tanstack/react-router";

import { StudentAchievementsScreen } from "../-screens/achievements/student-achievements-screen";

/** ACH-02 */
export const Route = createFileRoute("/prototype/sige/_shell/logros/estudiante")({
  component: StudentAchievementsScreen,
});
