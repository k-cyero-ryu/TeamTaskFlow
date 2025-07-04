import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, LayoutDashboard, CheckSquare, ChevronDown, GitFork, Users, Package, Calculator, FileText, Building2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { NotificationsDropdown } from "./notifications-dropdown";

export function MainNav() {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["/api/messages/unread"],
    select: (data: any) => data?.count ?? 0,
  });

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location === "/"}
                onClick={() => setLocation("/")}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location === "/tasks"}
                onClick={() => setLocation("/tasks")}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Tasks
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location === "/workflows"}
                onClick={() => setLocation("/workflows")}
              >
                <GitFork className="mr-2 h-4 w-4" />
                Workflows
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location.startsWith("/chat")}
                onClick={() => setLocation("/chat")}
              >
                <div className="flex items-center">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                      {unreadCount}
                    </Badge>
                  )}
                </div>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location.startsWith("/channels")}
                onClick={() => setLocation("/channels")}
              >
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Channels
                </div>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location.startsWith("/estimations")}
                onClick={() => setLocation("/estimations")}
              >
                <div className="flex items-center">
                  <Calculator className="mr-2 h-4 w-4" />
                  Estimations
                </div>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location.startsWith("/proformas")}
                onClick={() => setLocation("/proformas")}
              >
                <div className="flex items-center">
                  <FileText className="mr-2 h-4 w-4" />
                  Proformas
                </div>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                active={location.startsWith("/stock")}
                onClick={() => setLocation("/stock")}
              >
                <div className="flex items-center">
                  <Package className="mr-2 h-4 w-4" />
                  Stock
                </div>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ml-auto flex items-center space-x-4">
          <NotificationsDropdown />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {user?.username?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{user?.username}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => setLocation("/users")}
              >
                User Management
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => setLocation("/company-settings")}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Company Settings
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => setLocation("/settings")}
              >
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}