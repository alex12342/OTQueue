import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { setCurrentUser } from "@/lib/auth";

interface SsoExchangeResponse {
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    passwordChangeRequired: boolean;
  };
}

interface ErrorResponse {
  message: string;
}

export default function SsoCallback() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      navigate("/login?error=no_code");
      return;
    }

    // Exchange the single-use code for a JWT
    customFetch<SsoExchangeResponse>("/api/sso/sso-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((data) => {
        // Store the JWT token and user info
        setCurrentUser(data.user.email, data.user.role as "user" | "admin" | "viewer", data.token, data.user);

        // Use window.location.href for a full page reload so AuthGuard
        // re-initializes with the new auth state (its isAuth state is
        // set once at mount and does not react to runtime changes).
        if (data.user?.passwordChangeRequired) {
          window.location.href = "/change-password";
        } else {
          window.location.href = "/";
        }
      })
      .catch((err: ErrorResponse) => {
        console.error("SSO exchange error:", err);
        setStatus("error");
      });
  }, [navigate]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-destructive mb-4">Authentication failed. Please try again.</p>
          <a href="/login" className="text-primary hover:underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
