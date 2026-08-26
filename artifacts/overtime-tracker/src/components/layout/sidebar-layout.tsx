import React from "react";
import { Link, useLocation } from "wouter";
import { ClipboardList, Users, History, PlusCircle, LayoutDashboard, Settings, ChevronDown, BookOpen, LogOut, User, FileText, Scale, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoster } from "@/hooks/use-roster";
import { useIsMobile } from "@/hooks/use-mobile";
import { isViewer } from "@/lib/auth";
import { versionLabel } from "@/lib/version";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

const allNavigation = [
  { name: "Up Next", href: "/", icon: LayoutDashboard },
  { name: "Log Event", href: "/events/new", icon: PlusCircle },
  { name: "Event Log", href: "/log", icon: History },
  { name: "Employees", href: "/employees", icon: Users },
];

export function SidebarContent() {
  const [location] = useLocation();
  const { rosters, activeRoster, setActiveRosterId } = useRoster();
  const viewer = isViewer();

  const navigation = allNavigation.filter(item => {
    if (!viewer) return true;
    // Viewers can only see read-only pages
    if (item.href === "/events/new") return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
        <ClipboardList className="h-6 w-6 mr-3 text-sidebar-primary" />
        <span className="font-bold text-lg tracking-tight">OTQue</span>
      </div>

      {/* Roster selector */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1.5">Roster</p>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-sidebar-foreground">
            <span className="truncate">{rosters.length > 0 ? (activeRoster?.name ?? "Select roster") : "Manage Rosters"}</span>
            <ChevronDown className="h-4 w-4 shrink-0 ml-2 text-sidebar-foreground/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Switch Roster</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {rosters.length > 0 ? rosters.map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onClick={() => setActiveRosterId(r.id)}
                  className={cn(activeRoster?.id === r.id && "font-semibold")}
                >
                  {r.name}
                  {activeRoster?.id === r.id && (
                    <span className="ml-auto text-xs text-muted-foreground">active</span>
                  )}
                </DropdownMenuItem>
              ))
              : (
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer w-full">
                    Manage Rosters
                  </Link>
                </DropdownMenuItem>
              )
            }
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-4 py-6">
          <div className="text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase mb-4 px-2">
            Menu
          </div>
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 shrink-0",
                    isActive
                      ? "text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 pb-6">
          <Link
            href="/settings"
            className={cn(
              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
              location === "/settings"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Settings
              className={cn(
                "mr-3 h-5 w-5 shrink-0",
                location === "/settings"
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
              )}
            />
            Settings
          </Link>
          <Link
            href="/help"
            className={cn(
              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
              location === "/help"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <BookOpen
              className={cn(
                "mr-3 h-5 w-5 shrink-0",
                location === "/help"
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
              )}
            />
            Help
          </Link>
          <Link
            href="/privacy"
            className={cn(
              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
              location === "/privacy"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <FileText
              className={cn(
                "mr-3 h-5 w-5 shrink-0",
                location === "/privacy"
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
              )}
            />
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className={cn(
              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
              location === "/terms"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Scale
              className={cn(
                "mr-3 h-5 w-5 shrink-0",
                location === "/terms"
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
              )}
            />
            Terms of Service
          </Link>
          <Link
            href="/my-account"
            className={cn(
              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
              location === "/my-account"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <User
              className={cn(
                "mr-3 h-5 w-5 shrink-0",
                location === "/my-account"
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
              )}
            />
            My Account
          </Link>
          <Link
            href="/logout"
            className={cn(
              "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <LogOut
              className={cn(
                "mr-3 h-5 w-5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
              )}
            />
            Logout
          </Link>
        </div>

        <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
          <span className="block font-mono text-[11px] text-sidebar-foreground/40">
            {versionLabel()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Close the drawer whenever the route changes
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  // Close the drawer if the viewport grows past the mobile breakpoint
  React.useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <div className="sticky top-0 hidden h-screen w-64 flex-col border-r md:flex">
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex items-center">
            <ClipboardList className="h-6 w-6 mr-3 text-primary" />
            <span className="font-bold text-lg">OTQue</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">App navigation, roster selector and account links</SheetDescription>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </div>
  );
}
