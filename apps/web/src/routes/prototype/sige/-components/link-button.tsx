import { Button, buttonVariants } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";

import type { Role } from "../-mock/types";
import { ScreenLink, SigeLink } from "./sige-link";

type ButtonStyle = Pick<ComponentProps<typeof Button>, "variant" | "size">;

/** Router link styled as a button (a real anchor, so no button-semantics warnings). */
export function ScreenLinkButton({
  screenId,
  search,
  variant = "outline",
  size,
  className,
  children,
}: ButtonStyle & {
  screenId: string;
  search?: Record<string, string | undefined>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ScreenLink
      screenId={screenId}
      search={search}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </ScreenLink>
  );
}

export function SigeLinkButton({
  to,
  params,
  asRole,
  variant = "outline",
  size,
  className,
  children,
}: ButtonStyle & {
  to: string;
  params?: Record<string, string>;
  asRole?: Role;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SigeLink
      to={to}
      params={params}
      asRole={asRole}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </SigeLink>
  );
}
