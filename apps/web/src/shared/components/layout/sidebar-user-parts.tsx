import { Avatar, AvatarFallback, AvatarImage } from "@base-template/ui/components/avatar";
import { Badge } from "@base-template/ui/components/badge";
import type { ReactNode } from "react";

import { getInitials } from "@/shared/lib/initials";
import type { RoleBadgeTone } from "@/shared/lib/role-label";

export type SidebarUser = {
  name: string;
  email: string;
  image?: string | null;
  /** Role badge under the name (sige/01 §5.2); omitted when the role is unknown. */
  role?: { label: string; tone: RoleBadgeTone };
};

export type SidebarUserMenuExtraItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
};

/** Props shared by the desktop and mobile variants of the user menu. */
export type SidebarUserMenuVariantProps = {
  user: SidebarUser;
  onSignOut: () => void;
  extraItems: readonly SidebarUserMenuExtraItem[];
  triggerLabel: string;
  triggerClassName: string;
  triggerContent: ReactNode;
};

export function UserAvatar({ user }: { user: SidebarUser }) {
  return (
    <Avatar className="rounded-md">
      {user.image ? <AvatarImage src={user.image} alt={`${user.name} avatar`} /> : null}
      <AvatarFallback className="rounded-md text-xs">{getInitials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

export function UserIdentity({ user }: { user: SidebarUser }) {
  return (
    <span className="grid min-w-0 flex-1 text-left text-[13px] leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      {user.role ? (
        <Badge variant={user.role.tone} className="mt-1 w-fit">
          {user.role.label}
        </Badge>
      ) : null}
    </span>
  );
}
