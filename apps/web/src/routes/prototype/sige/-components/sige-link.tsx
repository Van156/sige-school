import { Link } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";

import type { Role } from "../-mock/types";
import { hrefFor, screenById } from "../-screens";
import { useRole } from "../-lib/use-role";

type AnchorProps = Omit<ComponentPropsWithoutRef<"a">, "href">;

type SigeLinkProps = AnchorProps & {
  /** Any `/prototype/sige/...` route path (type-checked by the screen registry, not here). */
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | undefined>;
  /** Forces a role instead of keeping the current one (role-specific dashboards). */
  asRole?: Role;
};

/**
 * Router link that keeps the `?role=` search param across navigation. Targets come from the
 * screen registry, so the route union is not re-checked here.
 */
export function SigeLink({ to, params, search, asRole, ...props }: SigeLinkProps) {
  const currentRole = useRole();
  return (
    <Link
      to={to as never}
      params={params as never}
      search={{ ...search, role: asRole ?? currentRole } as never}
      {...props}
    />
  );
}

type ScreenLinkProps = AnchorProps & {
  screenId: string;
  search?: Record<string, string | undefined>;
};

/** Link to a screen by id: its own route when built, the placeholder otherwise. */
export function ScreenLink({ screenId, search, children, ...props }: ScreenLinkProps) {
  const screen = screenById.get(screenId);
  if (!screen) return <span {...props}>{children}</span>;
  const href = hrefFor(screen);
  return (
    <SigeLink to={href.to} params={href.params} asRole={href.asRole} search={search} {...props}>
      {children}
    </SigeLink>
  );
}
