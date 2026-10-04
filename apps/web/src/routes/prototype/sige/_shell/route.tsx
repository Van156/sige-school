import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SigeShell } from "../-components/sige-shell";

/** Pathless layout: everything inside renders in the SIGE app shell. */
export const Route = createFileRoute("/prototype/sige/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  return (
    <SigeShell>
      <Outlet />
    </SigeShell>
  );
}
