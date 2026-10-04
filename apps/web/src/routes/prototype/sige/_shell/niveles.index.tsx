import { createFileRoute } from "@tanstack/react-router";

import { LevelsScreen } from "../-screens/institution/levels-screen";

/** INS-09 */
export const Route = createFileRoute("/prototype/sige/_shell/niveles/")({
  component: LevelsScreen,
});
