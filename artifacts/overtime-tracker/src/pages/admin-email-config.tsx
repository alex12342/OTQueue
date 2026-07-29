import { useState, useEffect, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getUserRole, initAuth } from "@/lib/auth";
import {
  Mail,
  Server,
  User as UserIcon,
  Lock,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

type Protocol = "none" | "starttls" | "implicit";

interface EmailConfig {
  email_host: string;
  email_port: number;
  email_user: string;
  email_pass: string;
  email_from: string;
  email_protocol: Protocol;
  configured: boolean;
}

const PROTOCOL_OPTIONS: { value: Protocol; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No encryption (not recommended)" },
  { value: "starttls", label: "STARTTLS", description: "Plain text → upgrade to TLS (port 587)" },
  { value: "implicit", label: "Implicit SSL", description: "TLS from connection start (port 465)" },
];

const PROVIDER_HINTS = [
  { provider: "Gmail", host: "smtp.gmail.com", port: 587, protocol: "STARTTLS" },
  { provider: "Gmail (SSL)", host: "smtp.gmail.com", port: 465, protocol: "Implicit SSL" },
  { provider: "Outlook/Office 365", host: "smtp.office365.com", port: 587, protocol: "STARTTLS" },
  { provider: "SendGrid", host: "smtp.sendgrid.net", port: 587, protocol: "STARTTLS" },
  { provider: "Mailgun", host: "smtp.mailgun.org", port: 587, protocol: "STARTTLS" },
  { provider: "Postmark", host: "smtp.postmarkapp.com", port: 587, protocol: "STARTTLS" },
];

export default function AdminEmailConfigPage() {
  const { toast } = useToast();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("starttls");

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await customFetch<EmailConfig>("/api/admin/email-config", { method: "GET" });
      setConfig(data);
      setProtocol(data.email_protocol || "starttls");
    } catch (error) {
      console.error("Error fetching email config:", error);
      toast({
        title: "Failed to load email configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      const role = getUserRole();
      if (!role) {
        await initAuth();
        if (cancelled) return;
        setIsAuthReady(true);
        setIsAdmin(getUserRole() === "admin");
      } else {
        if (cancelled) return;
        setIsAuthReady(true);
        setIsAdmin(role === "admin");
      }
    };
    checkAuth();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchConfig();
    }
  }, [isAdmin, fetchConfig]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);

    const fd = new FormData(e.currentTarget);
    const host = fd.get("email_host") as string;
    const port = parseInt(fd.get("email_port") as string, 10);
    const user = fd.get("email_user") as string;
    const pass = fd.get("email_pass") as string;
    const from = fd.get("email_from") as string;

    try {
      await customFetch<void>("/api/admin/email-config", {
        method: "PUT",
        body: JSON.stringify({
          email_host: host,
          email_port: port,
          email_user: user,
          email_pass: pass,
          email_from: from,
          email_protocol: protocol,
        }),
      });

      toast({
        title: "Configuration saved",
        description: "Email settings have been updated successfully.",
      });
      await fetchConfig();
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || "Failed to save configuration";
      toast({
        title: "Failed to save",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testRecipient || !testRecipient.includes("@")) {
      toast({
        title: "Invalid recipient",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const data = await customFetch<{ success: boolean; message: string }>("/api/admin/email/test", {
        method: "POST",
        body: JSON.stringify({
          to: testRecipient,
          email_from: config?.email_from || "noreply@localhost",
        }),
      });

      setTestResult({ success: true, message: data.message || "Test email sent successfully" });
      toast({
        title: "Test email sent",
        description: `A test email was sent to ${testRecipient}.`,
      });
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || "Failed to send test email";
      setTestResult({ success: false, message: msg });
      toast({
        title: "Test email failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="mt-4">
        <CardContent className="p-6 text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Access denied. Only administrators can manage email configuration.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Email Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure SMTP settings used for password reset links, user invites, and other system notifications.
        </p>
      </div>

      {/* Config Status */}
      <div className="flex items-center gap-2">
        {config?.configured ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="h-3.5 w-3.5" />
            Configured
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <AlertCircle className="h-3.5 w-3.5" />
            Not configured
          </span>
        )}
      </div>

      {/* Configuration Form */}
      {loading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" />
                SMTP Settings
              </CardTitle>
              <CardDescription>
                Enter your SMTP server details for sending system emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email_host" className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5" />
                    SMTP Host
                  </Label>
                  <Input
                    id="email_host"
                    name="email_host"
                    defaultValue={config?.email_host || ""}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_port" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Port
                  </Label>
                  <Input
                    id="email_port"
                    name="email_port"
                    type="number"
                    defaultValue={config?.email_port || 587}
                    placeholder="587"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email_user" className="flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5" />
                    Username
                  </Label>
                  <Input
                    id="email_user"
                    name="email_user"
                    defaultValue={config?.email_user || ""}
                    placeholder="your-email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_pass" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Password
                  </Label>
                  <Input
                    id="email_pass"
                    name="email_pass"
                    type="password"
                    defaultValue=""
                    placeholder={config?.email_pass ? "•••••• (leave blank to keep current)" : "SMTP password or app password"}
                  />
                  {config?.email_pass && (
                    <p className="text-xs text-muted-foreground">Leave blank to keep the current password</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_from" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  From Address
                </Label>
                <Input
                  id="email_from"
                  name="email_from"
                  defaultValue={config?.email_from || ""}
                  placeholder="noreply@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_protocol" className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" />
                  Connection Type
                </Label>
                <Select value={protocol} onValueChange={(v: Protocol) => setProtocol(v)}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select connection type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTOCOL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {PROTOCOL_OPTIONS.find((o) => o.value === protocol)?.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Configuration
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* Common Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Common SMTP Providers</CardTitle>
          <CardDescription>
            Quick reference for popular email providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Provider</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Host</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Port</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDER_HINTS.map((p) => (
                  <tr key={p.provider} className="border-b border-muted/50 last:border-0">
                    <td className="py-2 pr-4 font-medium">{p.provider}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.host}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.port}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {p.protocol}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Test Email Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Test Email
          </CardTitle>
          <CardDescription>
            Send a test email to verify your SMTP configuration is working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="test_recipient">Recipient Email</Label>
              <Input
                id="test_recipient"
                type="email"
                placeholder="recipient@example.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleTestEmail}
                disabled={testing || !config?.configured}
                className="w-full sm:w-auto"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-3 p-3 rounded-md text-sm ${
                testResult.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-medium">{testResult.success ? "Success" : "Failed"}</div>
                <div>{testResult.message}</div>
              </div>
            </div>
          )}

          {!config?.configured && (
            <div className="flex items-start gap-3 p-3 rounded-md text-sm bg-yellow-50 text-yellow-700 border border-yellow-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Please configure SMTP settings above before sending a test email.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
