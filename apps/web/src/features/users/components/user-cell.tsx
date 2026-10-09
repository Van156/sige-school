import { cn } from "@base-template/ui/lib/utils";
import {
  BookUser,
  ClipboardList,
  Eye,
  GraduationCap,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { roleKindTone, type RoleBadgeTone, type RoleKind } from "@/shared/lib/role-label";

const ROLE_ICONS: Record<RoleKind, LucideIcon> = {
  root: ShieldCheck,
  owner: ShieldCheck,
  admin: ShieldCheck,
  coordinator: ClipboardList,
  teacher: BookUser,
  student: GraduationCap,
  parent: Users,
  viewer: Eye,
  custom: UserRound,
};

const TONE_CLASSES: Record<RoleBadgeTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "bg-muted text-muted-foreground",
};

/**
 * Identity cell of a user (sige/03 §5.6): role-coloured icon, username and a small email line
 * ("Sin correo" in muted text for placeholder addresses). Presentational.
 */
export default function UserCell({
  username,
  email,
  role,
}: {
  username: string;
  /** `null` when the user has no real email. */
  email: string | null;
  role: RoleKind;
}) {
  const Icon = ROLE_ICONS[role];
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          TONE_CLASSES[roleKindTone(role)],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{username}</span>
        {email ? (
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        ) : (
          <span className="text-xs text-muted-foreground/70">Sin correo</span>
        )}
      </div>
    </div>
  );
}
