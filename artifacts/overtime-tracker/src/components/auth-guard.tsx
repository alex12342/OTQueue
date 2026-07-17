import React, { useState, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { isLoggedIn, isAuthInitialized, initAuth, getPasswordChangeRequired } from "@/lib/auth";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ChangePassword from "@/pages/change-password";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AUTH_PAGES = ["/login", "/forgot-password"];

/**
 * AuthGuard implements a three-state routing system:
 *
 * 1. no-session (!isLoggedIn) → show /login, /forgot-password; redirect all others to /login
 * 2. password-change-required (isLoggedIn + passwordChangeRequired=true) → show /change-password; redirect all others to /change-password
 * 3. authenticated (isLoggedIn + !passwordChangeRequired) → show app pages; redirect /login and /forgot-password to /
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [isChecking, setIsChecking] = useState(() => !isAuthInitialized());
  const [isAuth, setIsAuth] = useState(() => isAuthInitialized() ? isLoggedIn() : false);
  const [currentPath, setCurrentPath] = useLocation();

  useEffect(() => {
    if (!isAuthInitialized()) {
      initAuth().finally(() => {
        setIsChecking(false);
        setIsAuth(isLoggedIn());
      });
    } else {
      setIsChecking(false);
    }
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const passwordChangeRequired = getPasswordChangeRequired();

  // State 2: password-change-required — allow /change-password, redirect everything else to /change-password
  if (isAuth && passwordChangeRequired) {
    if (currentPath !== "/change-password" && currentPath !== "/login" && currentPath !== "/forgot-password") {
      setCurrentPath("/change-password");
      return null;
    }
    return (
      <Switch>
        <Route path="/change-password" component={ChangePassword} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // State 1: no-session — allow /login and /forgot-password, redirect everything else to /login
  if (!isAuth) {
    if (currentPath !== "/login" && currentPath !== "/forgot-password") {
      setCurrentPath("/login");
      return null;
    }
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // State 3: authenticated — redirect /login and /forgot-password to /, otherwise show app
  if (AUTH_PAGES.includes(currentPath)) {
    setCurrentPath("/");
    return null;
  }

  return <>{children}</>;
}
