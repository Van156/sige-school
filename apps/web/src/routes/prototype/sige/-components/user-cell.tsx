import { cn } from "@base-template/ui/lib/utils";
import {
  GraduationCap,
  HeartHandshake,
  Eye,
  ShieldCheck,
  UserRound,
  Users,
  Crown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Role, User } from "../-mock/types";

const ROLE_ICON: Record<Role, LucideIcon> = {
  root: Crown,
  admin: ShieldCheck,
  coordinator: Users,
  teacher: UserRound,
  student: GraduationCap,
  parent: HeartHandshake,
  viewer: Eye,
};

const ROLE_ICON_TONE: Record<Role, string> = {
  root: "bg-primary/10 text-primary",
  admin: "bg-success/15 text-success",
  coordinator: "bg-info/15 text-info",
  teacher: "bg-warning/20 text-foreground",
  student: "bg-muted text-foreground",
  parent: "bg-muted text-foreground",
  viewer: "bg-muted text-muted-foreground",
};

/** Role-coloured icon, username and email: the "Usuario" cell of the user tables. */
export function UserCell({ user }: { user: Pick<User, "role" | "username" | "email"> }) {
  const Icon = ROLE_ICON[user.role];
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          ROLE_ICON_TONE[user.role],
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{user.username}</span>
        {user.email ? (
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        ) : null}
      </div>
    </div>
  );
}
