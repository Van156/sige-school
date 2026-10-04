import { createFileRoute } from "@tanstack/react-router";

import { UserEditScreen } from "../-screens/users/user-form-screen";

/** USR-03 */
export const Route = createFileRoute("/prototype/sige/_shell/usuarios/editar")({
  component: UserEditScreen,
});
