import { Link, useLocation } from "wouter";
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
import { MessageCircle, LayoutDashboard, CheckSquare, ChevronDown } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

export function MainNav() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const { data: unreadCount } = useQuery({
    queryKey: ["/api/messages/unread"],
  });

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href="/">
                <NavigationMenuLink className={navigationMenuTriggerStyle()} active={location === "/"}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/tasks">
                <NavigationMenuLink className={navigationMenuTriggerStyle()} active={location === "/tasks"}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Tasks
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/chat">
                <NavigationMenuLink className={navigationMenuTriggerStyle()} active={location.startsWith("/chat")}>
                  <div className="flex items-center">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat
                    {unreadCount?.count > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                        {unreadCount.count}
                      </Badge>
                    )}
                  </div>
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ml-auto flex items-center space-x-4">
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
              <Link href="/users">
                <DropdownMenuItem className="cursor-pointer">
                  User Management
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => logoutMutation.mutate()}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
