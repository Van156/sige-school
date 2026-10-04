import { createFileRoute } from "@tanstack/react-router";

import { BlocksScreen } from "../-screens/school/blocks-screen";

/** SCH-09 */
export const Route = createFileRoute("/prototype/sige/_shell/bloques/")({
  component: BlocksScreen,
});
