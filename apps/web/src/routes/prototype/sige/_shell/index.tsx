import { createFileRoute } from "@tanstack/react-router";

import { ScreenIndex } from "../-screens/screen-index";

export const Route = createFileRoute("/prototype/sige/_shell/")({
  component: ScreenIndex,
});
