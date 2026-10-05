import { createFileRoute } from "@tanstack/react-router";

import { LeaderboardScreen } from "../-screens/achievements/leaderboard-screen";

/** ACH-03 */
export const Route = createFileRoute("/prototype/sige/_shell/logros/ranking")({
  component: LeaderboardScreen,
});
