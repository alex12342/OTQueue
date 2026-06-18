import React from "react";
import { Link, useLocation } from "wouter";
import { ClipboardList, Users, History, PlusCircle, Calendar, BarChart3, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Up Next", href: "/", icon: LayoutDashboard },
  { name: "Log Event", href: "/events/new", icon: PlusCircle },
  { name: "Event Log", href: "/log", icon: History },
  { name: "Employees", href: "/employees", icon: Users },
];

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <div className="hidden w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
          <ClipboardList className="h-6 w-6 mr-3 text-sidebar-primary" />
          <span className="font-bold text-lg tracking-tight">OTQueue</span>
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
                      isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex items-center">
            <ClipboardList className="h-6 w-6 mr-3 text-primary" />
            <span className="font-bold text-lg">OTQueue</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
