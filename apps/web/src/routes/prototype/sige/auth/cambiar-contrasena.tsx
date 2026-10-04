import { createFileRoute } from "@tanstack/react-router";

import { ForcePasswordScreen } from "../-screens/force-password-screen";

export const Route = createFileRoute("/prototype/sige/auth/cambiar-contrasena")({
  component: ForcePasswordScreen,
});
