import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { RosterProvider } from "@/hooks/use-roster";
import { AuthGuard } from "@/components/auth-guard";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LogEvent from "@/pages/log-event";
import EditEvent from "@/pages/edit-event";
import EventLog from "@/pages/event-log";
import Employees from "@/pages/employees";
import EmployeeReport from "@/pages/employee-report";
import Settings from "@/pages/settings";
import AdminUsers from "@/pages/admin-users";
import HelpPage from "@/pages/help";
import Login from "@/pages/login";
import Logout from "@/pages/logout";
import ForgotPassword from "@/pages/forgot-password";
import SetPassword from "@/pages/set-password";
import ChangePassword from "@/pages/change-password";
import MyAccount from "@/pages/my-account";
import { getPasswordChangeRequired } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function PasswordChangeRequiredGuard({ children }: { children: React.ReactNode }) {
  const [currentPath] = useLocation();
  if (getPasswordChangeRequired() && currentPath !== "/change-password") {
    window.location.href = "/change-password";
    return null;
  }
  return <>{children}</>;
}

function AppContent() {
  const [currentPath] = useLocation();
  const authPages = ["/login", "/logout", "/forgot-password", "/set-password", "/change-password"];
  const showSidebar = !getPasswordChangeRequired() && !authPages.includes(currentPath);
  const content = (
    <PasswordChangeRequiredGuard>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/logout" component={Logout} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/change-password" component={ChangePassword} />
        <Route path="/my-account" component={MyAccount} />
        <Route path="/" component={Home} />
        <Route path="/events/new" component={LogEvent} />
        <Route path="/events/:id/edit" component={EditEvent} />
        <Route path="/log" component={EventLog} />
        <Route path="/employees" component={Employees} />
        <Route path="/employees/:id/report" component={EmployeeReport} />
        <Route path="/settings" component={Settings} />
        <Route path="/help" component={HelpPage} />

        <Route path="/admin/users" component={AdminUsers} />
        <Route component={NotFound} />
      </Switch>
    </PasswordChangeRequiredGuard>
  );

  return showSidebar ? <SidebarLayout>{content}</SidebarLayout> : content;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <RosterProvider>
            <AuthGuard>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </AuthGuard>
            <Toaster />
          </RosterProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
