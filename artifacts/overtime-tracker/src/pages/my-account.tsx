import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { getUserEmail, getUserRole, getUserId, getUserRole as getRole, isLoggedIn } from "@/lib/auth";
import { User, Mail, Lock, KeyRound, Save, X, Loader2, Shield, AlertCircle, CheckCircle } from "lucide-react";

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordChangeRequired: boolean;
}

export default function MyAccount() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setError(null);
      const data = await customFetch<{ authenticated: boolean; user: CurrentUser }>("/api/auth/verify-session", {
        method: "GET",
      });
      if (data?.authenticated && data?.user) {
        setUser(data.user);
        setNewEmail(data.user.email);
      } else {
        navigate("/login");
      }
    } catch (err: any) {
      console.error("Error fetching current user:", err);
      setError(err?.message || "Failed to load account details");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    try {
      setUpdatingEmail(true);
      await customFetch<void>("/api/auth/user", {
        method: "PATCH",
        body: JSON.stringify({ email: newEmail }),
      });
      toast({ title: "Email updated", description: "Your email has been updated successfully." });
      setEditingEmail(false);
      fetchCurrentUser();
    } catch (err: any) {
      console.error("Error updating email:", err);
      toast({ title: "Error updating email", description: err?.message || "Failed to update email", variant: "destructive" });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 12) {
      toast({ title: "Password too short", description: "Password must be at least 12 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    try {
      setUpdatingPassword(true);
      await customFetch<void>("/api/auth/user", {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword }),
      });
      toast({ title: "Password updated", description: "Your password has been updated successfully." });
      setNewPassword("");
      setConfirmPassword("");
      setEditingPassword(false);
    } catch (err: any) {
      console.error("Error changing password:", err);
      toast({ title: "Error updating password", description: err?.message || "Failed to update password", variant: "destructive" });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    window.location.href = "/logout";
  };

  if (loading) {
    return (
      <div className="space-y-8 max-w-3xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-72" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            My Account
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and security
          </p>
        </div>
        <Button onClick={handleLogout} variant="outline">
          <X className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
          <CardDescription>Your current account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <div className="flex items-center gap-2">
                <Badge variant={user?.role === "admin" ? "outline" : "default"}>
                  {user?.role}
                </Badge>
                {user?.role === "admin" && (
                  <Shield className="h-3.5 w-3.5 text-purple-500" />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm bg-green-100 text-green-700 w-fit">
                <CheckCircle className="h-3.5 w-3.5" />
                Active
              </div>
            </div>
          </div>

          {user?.passwordChangeRequired && (
            <Alert>
              <KeyRound className="h-4 w-4" />
              <AlertDescription>
                You are required to change your password. Please update your password below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Email Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Address
          </CardTitle>
          <CardDescription>Your current email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingEmail ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-email">New Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdateEmail} disabled={updatingEmail} className="flex-1">
                  {updatingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Email
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { setEditingEmail(false); fetchCurrentUser(); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{user?.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingEmail(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingPassword ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  minLength={12}
                />
                <p className="text-xs text-muted-foreground">At least 12 characters with uppercase, lowercase, number, and special character</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  minLength={12}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={updatingPassword || !newPassword || !confirmPassword} className="flex-1">
                  {updatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { setEditingPassword(false); setNewPassword(""); setConfirmPassword(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">••••••••••••</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingPassword(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Change Password
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Pencil({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;
}
