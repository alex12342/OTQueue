import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { RosterProvider } from "@/hooks/use-roster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LogEvent from "@/pages/log-event";
import EditEvent from "@/pages/edit-event";
import EventLog from "@/pages/event-log";
import Employees from "@/pages/employees";
import EmployeeReport from "@/pages/employee-report";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <SidebarLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/events/new" component={LogEvent} />
        <Route path="/events/:id/edit" component={EditEvent} />
        <Route path="/log" component={EventLog} />
        <Route path="/employees" component={Employees} />
        <Route path="/employees/:id/report" component={EmployeeReport} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </SidebarLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <RosterProvider>
            <Router />
          </RosterProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
