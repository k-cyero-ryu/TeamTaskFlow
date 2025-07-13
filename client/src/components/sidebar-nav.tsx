import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useProformaPermissions } from "@/hooks/use-proforma-permissions";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageCircle,
  LayoutDashboard,
  CheckSquare,
  ChevronDown,
  GitFork,
  Users,
  Package,
  Calculator,
  FileText,
  Building2,
  Receipt,
  Menu,
  X,
  Settings,
  UserCheck,
} from "lucide-react";
import { NotificationsDropdown } from "./notifications-dropdown";
import { LanguageSelector } from "./language-selector";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  requiresPermission?: boolean;
}

export function SidebarNav() {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { hasProformaAccess } = useProformaPermissions();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["/api/messages/unread"],
    select: (data: any) => data?.count ?? 0,
  });

  const navItems: NavItem[] = [
    {
      href: "/",
      icon: LayoutDashboard,
      label: t('dashboard'),
    },
    {
      href: "/tasks",
      icon: CheckSquare,
      label: t('tasks'),
    },
    {
      href: "/workflows",
      icon: GitFork,
      label: t('workflows'),
    },
    {
      href: "/chat",
      icon: MessageCircle,
      label: t('chat'),
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      href: "/channels",
      icon: Users,
      label: t('channels'),
    },
    {
      href: "/estimations",
      icon: Calculator,
      label: t('estimations'),
    },
    {
      href: "/proformas",
      icon: FileText,
      label: t('proformas'),
      requiresPermission: true,
    },
    {
      href: "/expenses",
      icon: Receipt,
      label: t('expenses'),
    },
    {
      href: "/stock",
      icon: Package,
      label: t('stock'),
    },
    {
      href: "/services",
      icon: Settings,
      label: "Services",
    },
    {
      href: "/clients",
      icon: UserCheck,
      label: "Clients",
    },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.requiresPermission && !hasProformaAccess) {
      return false;
    }
    return true;
  });

  const UserSection = () => (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <NotificationsDropdown />
          <LanguageSelector />
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start p-2 h-auto">
            <Avatar className="h-8 w-8 mr-3">
              <AvatarFallback>
                {user?.username?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start flex-1">
              <span className="text-sm font-medium">{user?.username}</span>
              <span className="text-xs text-muted-foreground">{t('clickForOptions')}</span>
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => setLocation("/users")}
          >
            {t('userManagement')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => setLocation("/company-settings")}
          >
            <Building2 className="mr-2 h-4 w-4" />
            {t('companySettings')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => setLocation("/settings")}
          >
            {t('settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? t('loggingOut') : t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const NavigationItems = () => (
    <div className="flex-1 overflow-y-auto p-2 mobile-scroll scrollbar-mobile">
      <div className="space-y-1 pb-4">
        {filteredNavItems.map((item) => {
          const isActive = location === item.href || 
            (item.href !== "/" && location.startsWith(item.href));
          
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-12 touch-manipulation text-left touch-optimized",
                isActive && "bg-secondary"
              )}
              onClick={() => {
                setLocation(item.href);
                setMobileOpen(false);
              }}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs flex-shrink-0">
                  {item.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-background">
      <UserSection />
      <NavigationItems />
    </div>
  );

  return (
    <>
      {/* Mobile navigation header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="touch-optimized">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col mobile-scroll">
              <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <h2 className="text-lg font-semibold">{t('navigation')}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  className="touch-optimized"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <UserSection />
                <NavigationItems />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <LanguageSelector />
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user?.username?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* Mobile top spacing */}
      <div className="lg:hidden h-20"></div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:bg-background lg:overflow-hidden">
        <SidebarContent />
      </div>
    </>
  );
}