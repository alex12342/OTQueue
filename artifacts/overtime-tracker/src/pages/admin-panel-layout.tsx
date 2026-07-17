import React from "react";
import { Link, useLocation } from "wouter";
import { ClipboardList, Users, History, PlusCircle, LayoutDashboard, Settings, Shield, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoster } from "@/hooks/use-roster";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Up Next", href: "/", icon: LayoutDashboard },
  { name: "Log Event", href: "/events/new", icon: PlusCircle },
  { name: "Event Log", href: "/log", icon: History },
  { name: "Employees", href: "/employees", icon: Users },
];

export function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { rosters, activeRoster, setActiveRosterId } = useRoster();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <div className="hidden w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
          <ClipboardList className="h-6 w-6 mr-3 text-sidebar-primary" />
          <span className="font-bold text-lg tracking-tight flex items-center gap-2">
            OTQue
            <Shield className="h-5 w-5 text-purple-500" />
          </span>
        </div>

        {/* Roster selector */}
        {rosters.length > 0 && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1.5">Roster</p>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-sidebar-foreground">
                <span className="truncate">{activeRoster?.name ?? "Select roster"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 ml-2 text-sidebar-foreground/50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Switch Roster</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {rosters.map((r) => (
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
                ))}
                <DropdownMenuSeparator />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

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
          
          {/* Admin Panel Link */}
          <div className="px-4 py-2">
            <Button 
              variant="outline" 
              className="w-full justify-between"
              onClick={() => window.location.href = "/admin"}
            >
              <Shield className="h-5 w-5 mr-2 text-purple-600" />
              Admin Panel
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </div>

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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex items-center">
            <ClipboardList className="h-6 w-6 mr-3 text-primary" />
            <span className="font-bold text-lg flex items-center gap-2">
              OTQue
              <Shield className="h-5 w-5 text-purple-500" />
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.location.href = "/admin"}
          >
            <Shield className="h-5 w-5 text-purple-600" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
