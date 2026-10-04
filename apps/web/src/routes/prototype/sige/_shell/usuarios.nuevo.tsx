import { createFileRoute } from "@tanstack/react-router";

import { UserCreateScreen } from "../-screens/users/user-form-screen";

/** USR-02 */
export const Route = createFileRoute("/prototype/sige/_shell/usuarios/nuevo")({
  component: UserCreateScreen,
});
