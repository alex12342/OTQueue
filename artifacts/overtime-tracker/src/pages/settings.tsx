import React, { useState } from "react";
import {
  useListRosters,
  getListRostersQueryKey,
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
} from "@workspace/api-client-react";
import type { Roster, Role, Subclass } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useRoster } from "@/hooks/use-roster";
import { PlusCircle, Pencil, Trash2, AlertTriangle } from "lucide-react";

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

      <Tabs defaultValue="criteria">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="criteria">Criteria</TabsTrigger>
          <TabsTrigger value="subclasses">Subclasses</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="rosters">Rosters</TabsTrigger>
        </TabsList>

        <TabsContent value="criteria">
          {activeRosterId ? (
            <CriteriaTab rosterId={activeRosterId} />
          ) : (
            <Card><CardContent className="p-6 text-muted-foreground">Select a roster to manage criteria.</CardContent></Card>
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

        <TabsContent value="rosters">
          <RostersTab
            activeRosterId={activeRosterId}
            onRosterSelect={setActiveRosterId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Criteria Tab ─────────────────────────────────────────────────────────────

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

  const handleToggle = (key: "useOfferedHours" | "useSeniority" | "useSubclassOrdering" | "useWeightedHours", value: boolean) => {
    updateMutation.mutate({ id: rosterId, data: { [key]: value } });
  };

  if (isLoading) return <Skeleton className="h-48 w-full mt-4" />;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Sorting Criteria</CardTitle>
        <CardDescription>
          Control which factors are used when building the Up Next rotation. Criteria are applied in order: subclass priority → offered hours → seniority.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium">Subclass Ordering</p>
            <p className="text-sm text-muted-foreground">
              Sort by subclass priority first (configured per-subclass in the Subclasses tab).
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
        <div className="flex items-center justify-between py-3 border-b">
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
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">Weighted Hours</p>
            <p className="text-sm text-muted-foreground">
              Apply per-subclass multipliers when calculating fairness score. Configure multipliers in the Subclasses tab.
            </p>
          </div>
          <Switch
            checked={settings?.useWeightedHours ?? false}
            onCheckedChange={(v) => handleToggle("useWeightedHours", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Subclasses Tab ────────────────────────────────────────────────────────────

function SubclassesTab({ rosterId }: { rosterId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubclass, setEditingSubclass] = useState<Subclass | null>(null);

  const { data: subclasses = [], isLoading } = useListSubclasses(rosterId, {
    query: { queryKey: getListSubclassesQueryKey(rosterId) },
  });

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

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      rosterId,
      data: {
        name: fd.get("name") as string,
        weekdayPriority: parseInt(fd.get("weekdayPriority") as string, 10) || 1,
        weekendPriority: parseInt(fd.get("weekendPriority") as string, 10) || 1,
        holidayPriority: parseInt(fd.get("holidayPriority") as string, 10) || 1,
        workedMultiplier: parseFloat(fd.get("workedMultiplier") as string) || 1,
        offeredMultiplier: parseFloat(fd.get("offeredMultiplier") as string) || 1,
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
        weekdayPriority: parseInt(fd.get("weekdayPriority") as string, 10) || 1,
        weekendPriority: parseInt(fd.get("weekendPriority") as string, 10) || 1,
        holidayPriority: parseInt(fd.get("holidayPriority") as string, 10) || 1,
        workedMultiplier: parseFloat(fd.get("workedMultiplier") as string) || 1,
        offeredMultiplier: parseFloat(fd.get("offeredMultiplier") as string) || 1,
      },
    });
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
      <div className="border rounded-md p-4 space-y-3 bg-muted/20">
        <p className="text-sm font-medium">Priority (lower = higher priority)</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Weekday</Label>
            <Input name="weekdayPriority" type="number" min="1" defaultValue={defaultValues?.weekdayPriority ?? 1} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Weekend</Label>
            <Input name="weekendPriority" type="number" min="1" defaultValue={defaultValues?.weekendPriority ?? 1} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Holiday</Label>
            <Input name="holidayPriority" type="number" min="1" defaultValue={defaultValues?.holidayPriority ?? 1} />
          </div>
        </div>
      </div>
      <div className="border rounded-md p-4 space-y-3 bg-muted/20">
        <p className="text-sm font-medium">Weighted Hours Multipliers</p>
        <p className="text-xs text-muted-foreground">Applied to hours when "Weighted Hours" is enabled in Criteria.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Offered Multiplier</Label>
            <Input name="offeredMultiplier" type="number" step="0.1" min="0" defaultValue={defaultValues?.offeredMultiplier ?? 1.0} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Worked Multiplier</Label>
            <Input name="workedMultiplier" type="number" step="0.1" min="0" defaultValue={defaultValues?.workedMultiplier ?? 1.0} />
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending}>{submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subclasses</CardTitle>
          <CardDescription>Define employment types (e.g. Full-Time, 4-Hour) with their priority and optional hour multipliers.</CardDescription>
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
            {subclasses.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Priority — Weekday: {s.weekdayPriority}, Weekend: {s.weekendPriority}, Holiday: {s.holidayPriority}
                      {" · "}
                      Multipliers — Offered: {s.offeredMultiplier}×, Worked: {s.workedMultiplier}×
                    </p>
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
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"? Employees assigned to it will lose their subclass.`)) {
                        deleteMutation.mutate({ rosterId, id: s.id });
                      }
                    }}
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
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab({ rosterId }: { rosterId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState("");

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
                    onClick={() => {
                      if (confirm(`Delete role "${r.name}"?`)) {
                        deleteMutation.mutate({ rosterId, id: r.id });
                      }
                    }}
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
  );
}

// ── Rosters Tab ───────────────────────────────────────────────────────────────

function RostersTab({ activeRosterId, onRosterSelect }: { activeRosterId: number | null; onRosterSelect: (id: number) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRoster, setEditingRoster] = useState<Roster | null>(null);

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
                      onClick={() => {
                        if (confirm(`Delete roster "${r.name}"? This will also delete all employees, events, roles, and subclasses in it.`)) {
                          deleteMutation.mutate({ id: r.id });
                        }
                      }}
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
  );
}
