import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  useListRosters,
  getListRostersQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateRoster,
  useUpdateRoster,
  useDeleteRoster,
  useGetRosterSettings,
  getGetRosterSettingsQueryKey,
  useUpdateRosterSettings,
  useListRoles,
  getListRolesQueryKey,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useListSubclasses,
  getListSubclassesQueryKey,
  useCreateSubclass,
  useUpdateSubclass,
  useDeleteSubclass,
  useListDayTypeConfig,
  getListDayTypeConfigQueryKey,
  useUpsertDayTypeConfig,
  useCreateDayTypeConfig,
  useDeleteDayTypeConfig,
  useListSubclassDayTypeSort,
  getListSubclassDayTypeSortQueryKey,
  usePutSubclassDayTypeSort,
  useDeleteSubclassDayTypeSort,
} from "@workspace/api-client-react";
import type { Roster, Role, Subclass, DayTypeConfig, SubclassDayTypeSortEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useRoster } from "@/hooks/use-roster";
import { customFetch, setAuthTokenGetter } from "@workspace/api-client-react";
import { getUserRole, initAuth } from "@/lib/auth";
import { PlusCircle, Pencil, Trash2, ChevronUp, ChevronDown, RotateCcw, Search, Shield, Users as UsersIcon, Eye, X, Lock, CheckCircle, AlertCircle } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeRosterId, setActiveRosterId } = useRoster();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure rosters, sorting criteria, and classification rules.</p>
      </div>

      <Tabs defaultValue="rosters">
        <div className="overflow-x-auto">
          <TabsList className="flex w-full min-w-max">
            <TabsTrigger value="rosters" className="flex-1">Rosters</TabsTrigger>
            <TabsTrigger value="criteria" className="flex-1">Criteria</TabsTrigger>
            <TabsTrigger value="day-types" className="flex-1">Day Types</TabsTrigger>
            <TabsTrigger value="subclasses" className="flex-1">Subclasses</TabsTrigger>
            <TabsTrigger value="roles" className="flex-1">Roles</TabsTrigger>
            <TabsTrigger value="reset-hours" className="flex-1">Reset Hours</TabsTrigger>
            <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rosters">
          <RostersTab
            activeRosterId={activeRosterId}
            onRosterSelect={setActiveRosterId}
          />
        </TabsContent>

        <TabsContent value="criteria">
          {activeRosterId ? (
            <CriteriaTab rosterId={activeRosterId} />
          ) : (
            <Card><CardContent className="p-6 text-muted-foreground">Select a roster to manage criteria.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="day-types">
          {activeRosterId ? (
            <DayTypesTab rosterId={activeRosterId} />
          ) : (
            <Card><CardContent className="p-6 text-muted-foreground">Select a roster to manage day types.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="subclasses">
          {activeRosterId ? (
            <SubclassesTab rosterId={activeRosterId} />
          ) : (
            <Card><CardContent className="p-6 text-muted-foreground">Select a roster to manage subclasses.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="roles">
          {activeRosterId ? (
            <RolesTab rosterId={activeRosterId} />
          ) : (
            <Card><CardContent className="p-6 text-muted-foreground">Select a roster to manage roles.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="reset-hours">
          {activeRosterId ? (
            <ResetHoursTab rosterId={activeRosterId} />
          ) : (
            <Card><CardContent className="p-6 text-muted-foreground">Select a roster to reset hours.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Criteria Tab ──────────────────────────────────────────────────────────────

function CriteriaTab({ rosterId }: { rosterId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetRosterSettings(rosterId, {
    query: { queryKey: getGetRosterSettingsQueryKey(rosterId) },
  });

  const updateMutation = useUpdateRosterSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Settings saved" });
        queryClient.invalidateQueries({ queryKey: getGetRosterSettingsQueryKey(rosterId) });
      },
      onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
    },
  });

  const handleToggle = (key: "useOfferedHours" | "useSeniority" | "useSubclassOrdering", value: boolean) => {
    updateMutation.mutate({ id: rosterId, data: { [key]: value } });
  };

  if (isLoading) return <Skeleton className="h-48 w-full mt-4" />;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Sorting Criteria</CardTitle>
        <CardDescription>
          Control which factors are used when building the Up Next rotation. Criteria are applied in order: subclass order → fairness hours → seniority.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium">Subclass Ordering</p>
            <p className="text-sm text-muted-foreground">
              Sort by subclass sort order first (configured per-subclass in the Subclasses tab).
            </p>
          </div>
          <Switch
            checked={settings?.useSubclassOrdering ?? true}
            onCheckedChange={(v) => handleToggle("useSubclassOrdering", v)}
          />
        </div>
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium">Offered Hours</p>
            <p className="text-sm text-muted-foreground">
              Employees with fewer offered hours appear earlier in the rotation.
            </p>
          </div>
          <Switch
            checked={settings?.useOfferedHours ?? true}
            onCheckedChange={(v) => handleToggle("useOfferedHours", v)}
          />
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">Seniority Tie-Breaker</p>
            <p className="text-sm text-muted-foreground">
              When hours are equal, lower seniority number takes priority.
            </p>
          </div>
          <Switch
            checked={settings?.useSeniority ?? true}
            onCheckedChange={(v) => handleToggle("useSeniority", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Day Types Tab ─────────────────────────────────────────────────────────────

function DayTypesTab({ rosterId }: { rosterId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDt, setEditingDt] = useState<DayTypeConfig | null>(null);
  const [localMultipliers, setLocalMultipliers] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ dayType: string; name: string } | null>(null);

  const { data: configs = [], isLoading } = useListDayTypeConfig(rosterId, {
    query: { queryKey: getListDayTypeConfigQueryKey(rosterId) },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDayTypeConfigQueryKey(rosterId) });

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const c of configs) {
      if (!(c.dayType in localMultipliers)) {
        init[c.dayType] = c.multiplier != null ? String(c.multiplier) : "";
      }
    }
    if (Object.keys(init).length > 0) {
      setLocalMultipliers((prev) => ({ ...init, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  const upsertMutation = useUpsertDayTypeConfig({
    mutation: {
      onSuccess: () => { toast({ title: "Saved" }); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const createMutation = useCreateDayTypeConfig({
    mutation: {
      onSuccess: () => { toast({ title: "Day type created" }); setIsCreateOpen(false); invalidate(); },
      onError: () => toast({ title: "Error creating day type", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteDayTypeConfig({
    mutation: {
      onSuccess: () => { toast({ title: "Day type deleted" }); invalidate(); },
      onError: () => toast({ title: "Error deleting day type", variant: "destructive" }),
    },
  });

  const handleToggle = (cfg: DayTypeConfig, enabled: boolean) => {
    upsertMutation.mutate({
      id: rosterId,
      dayType: cfg.dayType,
      data: {
        name: cfg.name,
        enabled,
        multiplier: localMultipliers[cfg.dayType] ? parseFloat(localMultipliers[cfg.dayType]) : null,
        sortOrder: cfg.sortOrder,
      },
    });
  };

  const handleMultiplierBlur = (cfg: DayTypeConfig) => {
    const mult = localMultipliers[cfg.dayType];
    upsertMutation.mutate({
      id: rosterId,
      dayType: cfg.dayType,
      data: {
        name: cfg.name,
        enabled: cfg.enabled,
        multiplier: mult ? parseFloat(mult) : null,
        sortOrder: cfg.sortOrder,
      },
    });
  };

  const handleMoveUp = (cfg: DayTypeConfig, idx: number) => {
    if (idx === 0) return;
    const prev = configs[idx - 1];
    upsertMutation.mutate({ id: rosterId, dayType: cfg.dayType, data: { name: cfg.name, enabled: cfg.enabled, multiplier: cfg.multiplier, sortOrder: prev.sortOrder } });
    upsertMutation.mutate({ id: rosterId, dayType: prev.dayType, data: { name: prev.name, enabled: prev.enabled, multiplier: prev.multiplier, sortOrder: cfg.sortOrder } });
  };

  const handleMoveDown = (cfg: DayTypeConfig, idx: number) => {
    if (idx === configs.length - 1) return;
    const next = configs[idx + 1];
    upsertMutation.mutate({ id: rosterId, dayType: cfg.dayType, data: { name: cfg.name, enabled: cfg.enabled, multiplier: cfg.multiplier, sortOrder: next.sortOrder } });
    upsertMutation.mutate({ id: rosterId, dayType: next.dayType, data: { name: next.name, enabled: next.enabled, multiplier: next.multiplier, sortOrder: cfg.sortOrder } });
  };

  const handleRename = (cfg: DayTypeConfig, name: string) => {
    upsertMutation.mutate({
      id: rosterId,
      dayType: cfg.dayType,
      data: { name, enabled: cfg.enabled, multiplier: cfg.multiplier, sortOrder: cfg.sortOrder },
    });
    setEditingDt(null);
  };

  if (isLoading) return <Skeleton className="h-48 w-full mt-4" />;

  return (
    <>
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Day Types</CardTitle>
          <CardDescription>
            Configure which day types are available when logging events. The multiplier auto-populates when logging and weights hours toward fairness. Disable a type to hide it from the Up Next tab.
          </CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 shrink-0"><PlusCircle className="h-4 w-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Day Type</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = fd.get("name") as string;
                // Slugify the dayType key
                const dayType = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
                createMutation.mutate({
                  id: rosterId,
                  data: {
                    dayType,
                    name,
                    enabled: true,
                    sortOrder: configs.length,
                    multiplier: fd.get("multiplier") ? parseFloat(fd.get("multiplier") as string) : null,
                  },
                });
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input name="name" placeholder="e.g. Public Holiday" required />
              </div>
              <div className="space-y-2">
                <Label>Multiplier (optional)</Label>
                <Input name="multiplier" type="number" step="0.1" min="0" placeholder="e.g. 1.5" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {!configs.length ? (
          <p className="text-muted-foreground p-6 text-sm">No day types configured. Add one to get started.</p>
        ) : (
          <div className="divide-y">
            {configs.map((cfg, idx) => (
              <div key={cfg.dayType} className="flex items-center gap-3 px-6 py-4">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-muted-foreground disabled:opacity-30"
                    disabled={idx === 0 || upsertMutation.isPending}
                    onClick={() => handleMoveUp(cfg, idx)}
                  ><ChevronUp className="h-3.5 w-3.5" /></Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-muted-foreground disabled:opacity-30"
                    disabled={idx === configs.length - 1 || upsertMutation.isPending}
                    onClick={() => handleMoveDown(cfg, idx)}
                  ><ChevronDown className="h-3.5 w-3.5" /></Button>
                </div>

                <div className="flex-1 min-w-0">
                  {editingDt?.dayType === cfg.dayType ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        handleRename(cfg, fd.get("name") as string);
                      }}
                    >
                      <Input name="name" defaultValue={cfg.name} className="h-7 text-sm" autoFocus />
                      <Button type="submit" size="sm" disabled={upsertMutation.isPending}>Save</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingDt(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cfg.name}</span>
                      <span className="text-xs text-muted-foreground font-mono bg-muted px-1 rounded">{cfg.dayType}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setEditingDt(cfg)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <Label className="text-xs text-muted-foreground">Multiplier</Label>
                    <Input
                      type="number" step="0.1" min="0" placeholder="None"
                      className="w-20 h-8 text-sm bg-background"
                      value={localMultipliers[cfg.dayType] ?? ""}
                      onChange={(e) => setLocalMultipliers((prev) => ({ ...prev, [cfg.dayType]: e.target.value }))}
                      onBlur={() => handleMultiplierBlur(cfg)}
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Label className="text-xs text-muted-foreground">Visible</Label>
                    <Switch
                      checked={cfg.enabled}
                      onCheckedChange={(v) => handleToggle(cfg, v)}
                      disabled={upsertMutation.isPending}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm({ dayType: cfg.dayType, name: cfg.name })}
                  ><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Day Type</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{deleteConfirm?.name}"? This won't change existing logged events.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deleteConfirm) {
                deleteMutation.mutate({ id: rosterId, dayType: deleteConfirm.dayType });
                setDeleteConfirm(null);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── Subclasses Tab ─────────────────────────────────────────────────────────────

function SubclassesTab({ rosterId }: { rosterId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubclass, setEditingSubclass] = useState<Subclass | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { data: subclasses = [], isLoading } = useListSubclasses(rosterId, {
    query: { queryKey: getListSubclassesQueryKey(rosterId) },
  });

  const { data: dayTypeConfigs = [] } = useListDayTypeConfig(rosterId, {
    query: { queryKey: getListDayTypeConfigQueryKey(rosterId) },
  });
  const enabledDayTypes = dayTypeConfigs.filter((c) => c.enabled);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListSubclassesQueryKey(rosterId) });

  const createMutation = useCreateSubclass({
    mutation: {
      onSuccess: () => { toast({ title: "Subclass created" }); setIsCreateOpen(false); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateSubclass({
    mutation: {
      onSuccess: () => { toast({ title: "Subclass updated" }); setEditingSubclass(null); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteSubclass({
    mutation: {
      onSuccess: () => { toast({ title: "Subclass deleted" }); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const handleMoveUp = (subclass: Subclass, idx: number) => {
    if (idx === 0) return;
    const prev = subclasses[idx - 1];
    updateMutation.mutate({ rosterId, id: subclass.id, data: { name: subclass.name, sortOrder: prev.sortOrder } });
    updateMutation.mutate({ rosterId, id: prev.id, data: { name: prev.name, sortOrder: subclass.sortOrder } });
  };

  const handleMoveDown = (subclass: Subclass, idx: number) => {
    if (idx === subclasses.length - 1) return;
    const next = subclasses[idx + 1];
    updateMutation.mutate({ rosterId, id: subclass.id, data: { name: subclass.name, sortOrder: next.sortOrder } });
    updateMutation.mutate({ rosterId, id: next.id, data: { name: next.name, sortOrder: subclass.sortOrder } });
  };

  const SubclassForm = ({ defaultValues, onSubmit, isPending, submitLabel }: {
    defaultValues?: Partial<Subclass>;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isPending: boolean;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input name="name" defaultValue={defaultValues?.name} placeholder="e.g. Full-Time" required />
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>{submitLabel}</Button>
      </div>
    </form>
  );

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      rosterId,
      data: {
        name: fd.get("name") as string,
        sortOrder: subclasses.length,
      },
    });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSubclass) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      rosterId,
      id: editingSubclass.id,
      data: {
        name: fd.get("name") as string,
        sortOrder: editingSubclass.sortOrder,
      },
    });
  };

  return (
    <>
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subclasses</CardTitle>
          <CardDescription>Define employment types (e.g. Full-Time, 4-Hour). Use the arrows to set their priority in the Up Next rotation.</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><PlusCircle className="h-4 w-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Subclass</DialogTitle></DialogHeader>
            <SubclassForm onSubmit={handleCreate} isPending={createMutation.isPending} submitLabel="Create" />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : !subclasses.length ? (
          <p className="text-muted-foreground p-6 text-sm">No subclasses yet. Add one to classify employees.</p>
        ) : (
          <div className="divide-y">
            {subclasses.map((s, idx) => (
              <div key={s.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0 || updateMutation.isPending}
                      onClick={() => handleMoveUp(s, idx)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === subclasses.length - 1 || updateMutation.isPending}
                      onClick={() => handleMoveDown(s, idx)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div>
                    <p className="font-medium">{s.name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog open={editingSubclass?.id === s.id} onOpenChange={(open) => !open && setEditingSubclass(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingSubclass(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Edit Subclass</DialogTitle></DialogHeader>
                      <SubclassForm
                        defaultValues={s}
                        onSubmit={handleEdit}
                        isPending={updateMutation.isPending}
                        submitLabel="Save Changes"
                      />
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm({ id: s.id, name: s.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Subclass</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{deleteConfirm?.name}"? Employees assigned to it will lose their subclass.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deleteConfirm) {
                deleteMutation.mutate({ rosterId, id: deleteConfirm.id });
                setDeleteConfirm(null);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {subclasses.length > 1 && enabledDayTypes.length > 0 && (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Per-Day-Type Ordering</CardTitle>
          <CardDescription>
            Override subclass priority for a specific day type. When enabled, the Up Next list uses this order instead of the global one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {enabledDayTypes.map((cfg) => (
            <DayTypeSortSection
              key={cfg.dayType}
              rosterId={rosterId}
              dayType={cfg.dayType}
              dayTypeName={cfg.name}
            />
          ))}
        </CardContent>
      </Card>
    )}
  </>
  );
}

// ── Per-Day-Type Sort Section ──────────────────────────────────────────────────

function DayTypeSortSection({ rosterId, dayType, dayTypeName }: {
  rosterId: number;
  dayType: string;
  dayTypeName: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const qk = getListSubclassDayTypeSortQueryKey(rosterId, dayType);

  const { data: entries = [], isLoading } = useListSubclassDayTypeSort(rosterId, dayType, {
    query: { queryKey: qk },
  });

  const hasOverride = entries.some((e) => e.isOverride);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk });

  const putMutation = usePutSubclassDayTypeSort({
    mutation: {
      onSuccess: () => { toast({ title: `Custom order saved for ${dayTypeName}` }); invalidate(); },
      onError: () => toast({ title: "Error saving order", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteSubclassDayTypeSort({
    mutation: {
      onSuccess: () => { toast({ title: `Reset to global order for ${dayTypeName}` }); invalidate(); },
      onError: () => toast({ title: "Error resetting order", variant: "destructive" }),
    },
  });

  const handleToggle = (on: boolean) => {
    if (!on) {
      deleteMutation.mutate({ id: rosterId, dayType });
    } else {
      putMutation.mutate({
        id: rosterId,
        dayType,
        data: entries.map((e, idx) => ({ subclassId: e.subclassId, sortOrder: idx })),
      });
    }
  };

  const handleMoveUp = (entry: SubclassDayTypeSortEntry, idx: number) => {
    if (idx === 0) return;
    const reordered = [...entries];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    putMutation.mutate({
      id: rosterId,
      dayType,
      data: reordered.map((e, i) => ({ subclassId: e.subclassId, sortOrder: i })),
    });
  };

  const handleMoveDown = (entry: SubclassDayTypeSortEntry, idx: number) => {
    if (idx === entries.length - 1) return;
    const reordered = [...entries];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    putMutation.mutate({
      id: rosterId,
      dayType,
      data: reordered.map((e, i) => ({ subclassId: e.subclassId, sortOrder: i })),
    });
  };

  if (isLoading || entries.length === 0) return null;

  const isBusy = putMutation.isPending || deleteMutation.isPending;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div>
          <p className="font-medium text-sm">{dayTypeName}</p>
          <p className="text-xs text-muted-foreground">
            {hasOverride ? "Custom order active" : "Using global order"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{hasOverride ? "Custom" : "Global"}</span>
          <Switch checked={hasOverride} onCheckedChange={handleToggle} disabled={isBusy} />
        </div>
      </div>
      {hasOverride && (
        <div className="divide-y">
          {entries.map((e, idx) => (
            <div key={e.subclassId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={idx === 0 || isBusy}
                  onClick={() => handleMoveUp(e, idx)}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={idx === entries.length - 1 || isBusy}
                  onClick={() => handleMoveDown(e, idx)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-sm">{e.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">#{idx + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab({ rosterId }: { rosterId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { data: roles = [], isLoading } = useListRoles(rosterId, {
    query: { queryKey: getListRolesQueryKey(rosterId) },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRolesQueryKey(rosterId) });

  const createMutation = useCreateRole({
    mutation: {
      onSuccess: () => { toast({ title: "Role created" }); setIsCreateOpen(false); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateRole({
    mutation: {
      onSuccess: () => { toast({ title: "Role updated" }); setEditingRole(null); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteRole({
    mutation: {
      onSuccess: () => { toast({ title: "Role deleted" }); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  return (
    <>
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Define job functions (e.g. Cleaner, Supervisor) to assign to employees.</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><PlusCircle className="h-4 w-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Role</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMutation.mutate({ rosterId, data: { name: fd.get("name") as string } });
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input name="name" placeholder="e.g. Cleaner" required />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !roles.length ? (
          <p className="text-muted-foreground p-6 text-sm">No roles yet. Add one to classify employee job functions.</p>
        ) : (
          <div className="divide-y">
            {roles.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-3">
                <span className="font-medium">{r.name}</span>
                <div className="flex gap-2">
                  <Dialog open={editingRole?.id === r.id} onOpenChange={(open) => !open && setEditingRole(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingRole(r); setEditName(r.name); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Edit Role</DialogTitle></DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateMutation.mutate({ rosterId, id: r.id, data: { name: editName } });
                        }}
                        className="space-y-4 pt-2"
                      >
                        <div className="space-y-2">
                          <Label>Role Name</Label>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                        </div>
                        <div className="flex justify-end">
                          <Button type="submit" disabled={updateMutation.isPending}>Save</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm({ id: r.id, name: r.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate({ rosterId, id: deleteConfirm.id });
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── Reset Hours Tab ─────────────────────────────────────────────────────────
function ResetHoursTab({ rosterId }: { rosterId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await customFetch<Response>(`/api/rosters/${rosterId}/normalize-hours`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to reset hours");
      }
      const body = await res.json();
      queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({ rosterId }) });
      setConfirmOpen(false);
      toast({
        title: "Hours reset",
        description: `A "Reset Hours" event has been added to the event log. Deleting it will undo the reset.`,
      });
    } catch (err) {
      toast({
        title: "Reset failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset Hours</CardTitle>
        <CardDescription>
          Reset all employee normalized hour totals to 0 for this roster. A "Reset Hours" event is added to the event log; deleting that event will undo the reset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4">
          <h4 className="font-medium mb-2">What this does:</h4>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Calculates each employee's current normalized (fairness) hours</li>
            <li>Creates a "Reset Hours" marker event in the event log</li>
            <li>Effectively resets all fairness scores to 0</li>
            <li>Historical event data remains intact and can be undone by deleting the reset event</li>
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={isResetting}
            className="gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            {isResetting ? "Resetting..." : "Reset All Totals to 0"}
          </Button>
          {isResetting && <span className="text-sm text-muted-foreground">This may take a moment...</span>}
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset All Hour Totals?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a "Reset Hours" event in the event log that zeroes out fairness scores for all employees in this roster. Deleting that event will undo the reset.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Reset Totals
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ── Rosters Tab ───────────────────────────────────────────────────────────────

function RostersTab({ activeRosterId, onRosterSelect }: { activeRosterId: number | null; onRosterSelect: (id: number) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRoster, setEditingRoster] = useState<Roster | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { data: rosters = [], isLoading } = useListRosters({
    query: { queryKey: getListRostersQueryKey() },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRostersQueryKey() });

  const createMutation = useCreateRoster({
    mutation: {
      onSuccess: (roster) => {
        toast({ title: "Roster created" });
        setIsCreateOpen(false);
        invalidate();
        onRosterSelect(roster.id);
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateRoster({
    mutation: {
      onSuccess: () => { toast({ title: "Roster updated" }); setEditingRoster(null); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteRoster({
    mutation: {
      onSuccess: () => { toast({ title: "Roster deleted" }); invalidate(); },
      onError: () => toast({ title: "Error", description: "Cannot delete roster with employees or events.", variant: "destructive" }),
    },
  });

  const RosterForm = ({ defaultValues, onSubmit, isPending, submitLabel }: {
    defaultValues?: Partial<Roster>;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isPending: boolean;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Roster Name</Label>
        <Input name="name" defaultValue={defaultValues?.name} placeholder="e.g. Cleaners" required />
      </div>
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Input name="description" defaultValue={defaultValues?.description ?? ""} placeholder="Brief description" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>{submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <>
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Rosters</CardTitle>
          <CardDescription>Each roster has its own employees, events, subclasses, roles, and settings.</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><PlusCircle className="h-4 w-4" /> New Roster</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Roster</DialogTitle></DialogHeader>
            <RosterForm
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMutation.mutate({ data: { name: fd.get("name") as string, description: fd.get("description") as string || null } });
              }}
              isPending={createMutation.isPending}
              submitLabel="Create Roster"
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : !rosters.length ? (
          <p className="text-muted-foreground p-6 text-sm">No rosters yet.</p>
        ) : (
          <div className="divide-y">
            {rosters.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.name}</p>
                      {activeRosterId === r.id && <Badge variant="secondary" className="text-xs">Active</Badge>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {activeRosterId !== r.id && (
                    <Button variant="outline" size="sm" onClick={() => onRosterSelect(r.id)}>
                      Switch To
                    </Button>
                  )}
                  <Dialog open={editingRoster?.id === r.id} onOpenChange={(open) => !open && setEditingRoster(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingRoster(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Edit Roster</DialogTitle></DialogHeader>
                      <RosterForm
                        defaultValues={r}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          updateMutation.mutate({ id: r.id, data: { name: fd.get("name") as string, description: fd.get("description") as string || null } });
                        }}
                        isPending={updateMutation.isPending}
                        submitLabel="Save Changes"
                      />
                    </DialogContent>
                  </Dialog>
                  {rosters.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm({ id: r.id, name: r.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Roster</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{deleteConfirm?.name}"? This will also delete all employees, events, roles, and subclasses in it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deleteConfirm) {
                deleteMutation.mutate({ id: deleteConfirm.id });
                setDeleteConfirm(null);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── Users Tab (Admin Only) ────────────────────────────────────────────────────

interface SettingsUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  isActive: boolean;
}

function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<SettingsUser | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<{ userId: string; role: "user" | "admin" } | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<"user" | "admin">("user");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updateEmailLoading, setUpdateEmailLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await customFetch<SettingsUser[]>("/api/admin/users", { method: "GET" });
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  const filteredUsers = useMemo(() =>
    users.filter(user =>
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [users, searchQuery]
  );

  const activeCount = useMemo(() => users.filter(u => u.isActive).length, [users]);
  const adminCount = useMemo(() => users.filter(u => u.role === "admin").length, [users]);

  const handleToggleActive = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try {
      await customFetch<void>(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      toast({
        title: user.isActive ? "User deactivated" : "User activated",
        description: `${user.name} is now ${user.isActive ? "inactive" : "active"}.`,
      });
      fetchUsers();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({ title: "Error updating user status", variant: "destructive" });
    }
  };

  const confirmDelete = async (userId: string) => {
    try {
      await customFetch<void>(`/api/admin/users/${userId}`, { method: "DELETE" });
      toast({ title: "User deleted" });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({ title: "Error deleting user", variant: "destructive" });
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateFormError(null);

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const name = fd.get("name") as string;
    if (!email || !password || !name) return;
    try {
      await customFetch<void>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      toast({ title: "User created", description: `Invite sent to ${email}` });
      setShowCreateForm(false);
      fetchUsers();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to create user";
      setCreateFormError(msg);
      toast({ title: "Failed to create user", description: msg, variant: "destructive" });
    }
  };

  const handleUpdateRole = async (userId: string) => {
    try {
      await customFetch<SettingsUser>(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ role: editRoleValue }),
      });
      toast({ title: "Role updated" });
      setEditingRole(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({ title: "Error updating role", variant: "destructive" });
    }
  };

  const handleUpdateEmail = async (userId: string) => {
    try {
      setUpdateEmailLoading(true);
      await customFetch<SettingsUser>(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ email: editEmailValue }),
      });
      toast({ title: "Email updated" });
      setEditingEmail(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating email:", error);
      toast({ title: "Error updating email", variant: "destructive" });
    } finally {
      setUpdateEmailLoading(false);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      setResetPasswordLoading(true);
      await customFetch<void>(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });
      toast({ title: "Password reset email sent", description: `Sent to ${selectedUser?.email}` });
      setShowResetPassword(false);
    } catch (error) {
      console.error("Error resetting password:", error);
      toast({ title: "Error sending reset email", variant: "destructive" });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleChangePassword = async (userId: string) => {
    if (!newPassword) return;
    try {
      setChangePasswordLoading(true);
      await customFetch<SettingsUser>(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      });
      toast({ title: "Password updated" });
      setNewPassword("");
      setShowResetPassword(false);
      fetchUsers();
    } catch (error) {
      console.error("Error changing password:", error);
      toast({ title: "Error updating password", variant: "destructive" });
    } finally {
      setChangePasswordLoading(false);
    }
  };

  if (!isAuthReady) {
    return <Skeleton className="h-48 w-full mt-4" />;
  }

  if (!isAdmin) {
    return (
      <Card className="mt-4">
        <CardContent className="p-6 text-muted-foreground">
          Access denied. Only administrators can manage users.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
        <div>
          <h2 className="text-xl font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Create, edit, and manage system users. Deactivating a user prevents them from logging in.
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? (
            <><X className="h-4 w-4 mr-1" /> Cancel</>
          ) : (
            <><PlusCircle className="h-4 w-4 mr-1" /> Create User</>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="text-sm text-muted-foreground">Total Users</div>
          <div className="text-2xl font-bold">{users.length}</div>
        </div>
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
        </div>
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="text-sm text-muted-foreground">Admins</div>
          <div className="text-2xl font-bold text-purple-600">{adminCount}</div>
        </div>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New User</CardTitle>
            <CardDescription>Add a new user to the system. An invite email will be sent.</CardDescription>
          </CardHeader>
          <CardContent>
            {createFormError && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {createFormError}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name</Label>
                <Input id="create-name" name="name" required placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input id="create-email" name="email" type="email" required placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Password</Label>
                <Input id="create-password" name="password" type="password" required placeholder="At least 12 characters" minLength={12} />
                <p className="text-xs text-muted-foreground">At least 12 characters with uppercase, lowercase, number, and special character</p>
              </div>
              <Button type="submit" className="w-full">Create User</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 border-border bg-background"
        />
      </div>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
          <CardDescription>Click a user to view details and manage their account.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {users.length === 0 ? "No users yet. Create one above." : "No users match your search."}
            </div>
          ) : (
            <div className="divide-y">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center gap-4 px-4 py-3 transition-colors cursor-pointer ${
                    selectedUser?.id === user.id
                      ? "bg-muted"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                >
                  {/* Role icon */}
                  <div className={`p-2 rounded-full shrink-0 ${
                    user.role === "admin"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-blue-100 text-blue-600"
                  }`}>
                    {user.role === "admin" ? <Shield className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}
                  </div>

                  {/* Name / Email */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{user.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                  </div>

                  {/* Role badge or inline editor */}
                  {editingRole?.userId === user.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        className="h-8 text-sm border rounded px-2 bg-background"
                        value={editRoleValue}
                        onChange={(e) => setEditRoleValue(e.target.value as "user" | "admin")}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={(e) => { e.stopPropagation(); handleUpdateRole(user.id); }}>
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setEditingRole(null); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant={user.role === "admin" ? "outline" : "default"} className="shrink-0">
                      {user.role}
                    </Badge>
                  )}

                  {/* Active toggle with label */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Lock className={`h-3.5 w-3.5 ${user.isActive ? "text-green-500" : "text-red-400"}`} />
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={() => handleToggleActive(user.id)}
                    />
                  </div>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(user.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected User Details Panel */}
      {selectedUser && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">User Details</CardTitle>
              <CardDescription>{selectedUser.name}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                {editingRole?.userId === selectedUser.id ? (
                  <div className="flex items-center gap-1">
                    <select
                      className="h-8 text-sm border rounded px-2 bg-background"
                      value={editRoleValue}
                      onChange={(e) => setEditRoleValue(e.target.value as "user" | "admin")}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => handleUpdateRole(selectedUser.id)}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingRole(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedUser.role === "admin" ? "outline" : "default"}>
                      {selectedUser.role}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingRole({ userId: selectedUser.id, role: selectedUser.role }); setEditRoleValue(selectedUser.role); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm ${
                  selectedUser.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {selectedUser.isActive ? "Active" : "Inactive"}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              {editingEmail === selectedUser.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 text-sm"
                    value={editEmailValue}
                    onChange={(e) => setEditEmailValue(e.target.value)}
                    type="email"
                  />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => handleUpdateEmail(selectedUser.id)} disabled={updateEmailLoading}>
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingEmail(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-sm">{selectedUser.email}</div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingEmail(selectedUser.id); setEditEmailValue(selectedUser.email); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              {showResetPassword ? (
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="New password (min 12 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={12}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600" onClick={() => handleChangePassword(selectedUser.id)} disabled={changePasswordLoading || !newPassword}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Set Password
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setShowResetPassword(false); setNewPassword(""); }}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">Or send a password reset email:</div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleResetPassword(selectedUser.id)} disabled={resetPasswordLoading}>
                    {resetPasswordLoading ? "Sending..." : "Send Reset Email"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">••••••••••••</div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowResetPassword(true)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                When a user is <strong>inactive</strong>, they cannot log in. Their account and data are preserved.
                Reactivate them to restore access.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => { setDeleteConfirm(selectedUser.id); setSelectedUser(null); }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone. All associated data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  confirmDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
