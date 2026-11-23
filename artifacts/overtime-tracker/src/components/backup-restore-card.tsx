/**
 * Admin-only Backup & Restore card, rendered inside the Settings → Users tab.
 *
 * Talks to /api/admin/backups (see artifacts/api-server/src/routes/admin-backup.ts):
 * lists archives stored in /app/data/backups/, creates manual backups, uploads
 * an archive from the admin's machine, downloads/deletes them, and restores —
 * which replaces ALL data and restarts the container. The restore dialog polls
 * /api/healthz until the app is back up again.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Loader2, PlusCircle, RotateCcw, Trash2, Upload } from "lucide-react";

interface BackupMeta {
  name: string;
  kind: "auto" | "manual" | "pre-restore";
  createdAt: string;
  appVersion?: string;
  sizeBytes: number;
  sha256: string;
  fileCount: number;
  originalName?: string;
}

interface ListResponse {
  backups: BackupMeta[];
  activeOperation: string | null;
}

function formatBytes(n: number): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const KIND_LABEL: Record<BackupMeta["kind"], string> = {
  auto: "daily",
  manual: "manual",
  "pre-restore": "pre-restore",
};

export function BackupRestoreCard() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // local operation label
  const [serverOp, setServerOp] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<BackupMeta | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false); // request in flight / restarting
  const [deleteTarget, setDeleteTarget] = useState<BackupMeta | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchList = useCallback(async () => {
    try {
      const data = await customFetch<ListResponse>("/api/admin/backups", { method: "GET" });
      setBackups(data.backups ?? []);
      setServerOp(data.activeOperation ?? null);
    } catch (error) {
      console.error("Error fetching backups:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const errMessage = (err: any, fallback: string) =>
    err?.data?.message || err?.message || fallback;

  // ── Operations ─────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setBusy("Creating backup…");
    try {
      const meta = await customFetch<BackupMeta>("/api/admin/backups", { method: "POST" });
      toast({ title: "Backup created", description: `${meta.name} (${formatBytes(meta.sizeBytes)})` });
      await fetchList();
    } catch (err: any) {
      if (err?.status === 409) {
        toast({ title: "Busy", description: "Another backup/restore is in progress.", variant: "destructive" });
      } else {
        toast({ title: "Backup failed", description: errMessage(err, "Unknown error"), variant: "destructive" });
      }
    } finally {
      setBusy(null);
      fetchList();
    }
  };

  const handleUpload = async (file: File) => {
    setBusy("Uploading archive…");
    try {
      const meta = await customFetch<BackupMeta>(
        `/api/admin/backups/upload?name=${encodeURIComponent(file.name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        },
      );
      toast({ title: "Upload complete", description: `${meta.name} is ready to restore.` });
      await fetchList();
    } catch (err: any) {
      toast({ title: "Upload failed", description: errMessage(err, "Unknown error"), variant: "destructive" });
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (meta: BackupMeta) => {
    try {
      const blob = await customFetch<Blob>(`/api/admin/backups/${encodeURIComponent(meta.name)}/download`, {
        method: "GET",
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      toast({ title: "Download failed", description: errMessage(err, "Unknown error"), variant: "destructive" });
    }
  };

  const handleDelete = async (meta: BackupMeta) => {
    try {
      await customFetch(`/api/admin/backups/${encodeURIComponent(meta.name)}`, { method: "DELETE" });
      toast({ title: "Backup deleted", description: meta.name });
      fetchList();
    } catch (err: any) {
      toast({ title: "Delete failed", description: errMessage(err, "Unknown error"), variant: "destructive" });
    }
  };

  /** POST the restore, then poll /api/healthz until the container is back. */
  const handleRestore = async (meta: BackupMeta) => {
    setRestoring(true);
    try {
      await customFetch(`/api/admin/backups/${encodeURIComponent(meta.name)}/restore`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
    } catch (err: any) {
      toast({ title: "Restore failed", description: errMessage(err, "Unknown error"), variant: "destructive" });
      setRestoring(false);
      return;
    }

    // Restore succeeded — the API exits and Docker restarts the container.
    toast({ title: "Restore complete", description: "The system is restarting with the restored data…" });
    // Give the old process time to actually exit first (it stays healthy for
    // ~1.5s after responding), otherwise healthz polling below would see the
    // dying instance and reload into a container that's still going down.
    await new Promise((r) => setTimeout(r, 4000));
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch("/api/healthz", { cache: "no-store" });
        if (res.ok) {
          toast({ title: "System restored", description: "Reloading…" });
          window.location.reload();
          return;
        }
      } catch {
        // Container still down — keep polling.
      }
    }
    setRestoring(false);
    toast({
      title: "Restore may have failed",
      description: "The app did not come back within 2 minutes. Check the container logs.",
      variant: "destructive",
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const operation = busy ?? serverOp;
  const disabled = !!operation || restoring;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">Backup &amp; Restore</CardTitle>
        <CardDescription>
          Archives contain the full database plus all data files (JWT secret, SSO whitelist, etc.).
          Daily automatic backups are kept for 5 days. Restoring replaces ALL current data and restarts the container.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCreate} disabled={disabled}>
            {busy === "Creating backup…" ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…</>
            ) : (
              <><PlusCircle className="h-4 w-4 mr-1" /> Create backup now</>
            )}
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
            {busy === "Uploading archive…" ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="h-4 w-4 mr-1" /> Upload archive</>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tar.gz,.tgz,application/gzip,application/x-gzip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
        </div>

        {/* In-progress banner */}
        {operation && !restoring && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Operation in progress: <strong>{operation}</strong> — please wait.
          </div>
        )}

        {/* Backup list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No backups yet. Create one now or wait for the next daily backup.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {backups.map((b) => (
              <div key={b.name} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate" title={b.name}>{b.originalName ?? b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(b.createdAt)} · {formatBytes(b.sizeBytes)}
                    {b.appVersion ? ` · v${b.appVersion}` : ""}
                  </div>
                </div>
                <Badge variant={b.kind === "auto" ? "secondary" : b.kind === "pre-restore" ? "destructive" : "outline"} className="shrink-0">
                  {KIND_LABEL[b.kind]}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" onClick={() => handleDownload(b)} disabled={restoring}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Restore from this backup"
                    onClick={() => { setRestoreTarget(b); setRestoreConfirmText(""); }}
                    disabled={disabled}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => setDeleteTarget(b)} disabled={restoring}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Restore-in-progress overlay state */}
        {restoring && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Restoring… the container is restarting with the restored data. This page will reload automatically when it's back.
          </div>
        )}

        {/* Restore confirmation dialog */}
        <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Restore from backup?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    This replaces <strong>ALL current data</strong> with the contents of{" "}
                    <span className="font-mono text-xs">{restoreTarget?.name}</span>:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>The entire database (rosters, events, users, settings)</li>
                    <li>All data files, including the JWT secret — everyone will be signed out</li>
                    <li>The container restarts automatically when done</li>
                  </ul>
                  <p>A safety backup of the current state is created first (kept as “pre-restore”).</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label htmlFor="restore-confirm" className="text-sm font-medium">
                Type <span className="font-mono">RESTORE</span> to confirm
              </label>
              <Input
                id="restore-confirm"
                value={restoreConfirmText}
                onChange={(e) => setRestoreConfirmText(e.target.value)}
                placeholder="RESTORE"
                autoComplete="off"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={restoreConfirmText !== "RESTORE" || restoring}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (restoreTarget) handleRestore(restoreTarget);
                }}
              >
                Restore &amp; restart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete backup?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.name} will be permanently removed. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget) handleDelete(deleteTarget);
                  setDeleteTarget(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default BackupRestoreCard;
