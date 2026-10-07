import { Button } from "@base-template/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@base-template/ui/components/dropdown-menu";
import { Skeleton } from "@base-template/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboardIcon, UserRoundIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { clearSigeMeCache } from "@/app/sige-me";
import SidebarUserMenu, { type SidebarUser } from "@/shared/components/layout/sidebar-user-menu";

import { handleSignOut } from "../lib/sign-out";

/**
 * `variant="sidebar"` renders the shell's footer menu; the default outline-button
 * variant stays for `PublicHeader` (R1.9).
 */
export default function UserMenu({
  variant = "header",
  role,
  showDashboard = false,
}: {
  variant?: "header" | "sidebar";
  /** Sidebar variant: the role badge shown with the user (sige/01 §5.2). */
  role?: SidebarUser["role"];
  /** Sidebar variant: adds the "Dashboard" entry (users with an institution). */
  showDashboard?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();

  const signOut = () =>
    handleSignOut({
      signOut: () => authClient.signOut(),
      clearSession: () => clearSigeMeCache(queryClient),
      onSignedOut: () => navigate({ to: "/" }),
      showError: (message) => toast.error(message),
    });

  const openAccountSettings = () => navigate({ to: "/account/profile" });

  if (variant === "sidebar") {
    if (!session && !isPending) {
      return null;
    }
    return (
      <SidebarUserMenu
        isLoading={isPending}
        user={{
          name: session?.user.name ?? "",
          email: session?.user.email ?? "",
          image: session?.user.image,
          role,
        }}
        onSignOut={signOut}
        extraItems={[
          ...(showDashboard
            ? [
                {
                  label: "Dashboard",
                  icon: <LayoutDashboardIcon />,
                  onSelect: () => navigate({ to: "/dashboard" }),
                },
              ]
            : []),
          { label: "Mi Perfil", icon: <UserRoundIcon />, onSelect: openAccountSettings },
        ]}
      />
    );
  }

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link to="/sign-in">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {session.user.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem onClick={openAccountSettings}>Account settings</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={signOut}>
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
