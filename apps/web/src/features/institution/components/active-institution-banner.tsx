import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { orpc } from "@/app/orpc";

import { institutionBannerBadge } from "../lib/institution-scope";
import InstitutionBanner from "./institution-banner";

/**
 * Container: the signed-in institution's banner from `institution.get` (`institution:read`, so
 * every staff role). Renders nothing while loading or on failure: the banner is context, not
 * content, and the page's own queries report their errors.
 */
export default function ActiveInstitutionBanner() {
  const { data: session } = authClient.useSession();
  const profile = useQuery(orpc.institution.get.queryOptions());

  if (!profile.data) {
    return null;
  }
  const { name, logo, municipality, department } = profile.data;
  return (
    <InstitutionBanner
      name={name}
      logo={logo}
      municipality={municipality}
      department={department}
      badge={institutionBannerBadge(session?.session.impersonatedBy)}
    />
  );
}
