import { buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import type { ReactNode } from "react";

import { authClient } from "@/app/auth-client";
import { isSuperadminRole } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";

import {
  INSTITUTION_SELECTOR_PATH,
  decideInstitutionScope,
  selectInstitutionMessage,
} from "../lib/institution-scope";

/**
 * Active-institution guard (sige/02 §5.3, `useActiveInstitutionGuard`): a superadmin with no
 * active organization sees "Selecciona una Institución" instead of the tenant structure page.
 * `pageName` completes the sentence, e.g. "sus niveles académicos".
 */
export default function ActiveInstitutionGuard({
  pageName,
  children,
}: {
  pageName: string;
  children: ReactNode;
}) {
  const { data: session, isPending } = authClient.useSession();
  const decision = decideInstitutionScope({
    isPending,
    isSuperadmin: isSuperadminRole(session?.user.role),
    activeOrganizationId: session?.session.activeOrganizationId,
  });

  if (decision === "pending") {
    return null;
  }
  if (decision === "allow") {
    return <>{children}</>;
  }
  return (
    <EmptyState
      icon={<Building2 />}
      title="Selecciona una Institución"
      description={selectInstitutionMessage(pageName)}
      action={
        <Link to={INSTITUTION_SELECTOR_PATH} className={buttonVariants()}>
          Ver instituciones
        </Link>
      }
    />
  );
}
