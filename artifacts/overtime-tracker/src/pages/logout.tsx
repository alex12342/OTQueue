import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { signOut } from "@/lib/auth";

export default function Logout() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Call signOut to clear internal auth state (_isLoggedIn, _userRole, etc.)
    // and sessionStorage, then redirect to login
    signOut().finally(() => {
      window.location.href = "/login";
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* This component will redirect immediately */}
    </div>
  );
}