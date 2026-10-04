import { createFileRoute } from "@tanstack/react-router";

import { LevelFormScreen } from "../-screens/institution/level-form-screen";

/** INS-10 */
export const Route = createFileRoute("/prototype/sige/_shell/niveles/formulario")({
  component: LevelFormScreen,
});
