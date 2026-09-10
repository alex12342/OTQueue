import React, { useState } from "react";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useListRoles,
  getListRolesQueryKey,
  useListSubclasses,
  getListSubclassesQueryKey,
  useGetRosterSettings,
  getGetRosterSettingsQueryKey,
} from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { isViewer } from "@/lib/auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useRoster } from "@/hooks/use-roster";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SeniorityMode = "manual" | "hire_date";

const EmployeeForm = ({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  seniorityMode,
  showStartingHours = false,
  roles,
  subclasses,
  manualStartingHours,
  setManualStartingHours,
  activeToggle,
  setActiveToggle,
}: {
  defaultValues?: Partial<Employee>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
  submitLabel: string;
  seniorityMode: SeniorityMode;
  showStartingHours?: boolean;
  roles: any[];
  subclasses: any[];
  manualStartingHours: boolean;
  setManualStartingHours: (v: boolean) => void;
  activeToggle: boolean;
  setActiveToggle: (v: boolean) => void;
}) => (
  <form onSubmit={onSubmit} className="space-y-4 pt-4">
    <div className="space-y-2">
      <Label htmlFor="name">Full Name</Label>
      <Input id="name" name="name" defaultValue={defaultValues?.name} required />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="seniority">
          Seniority #
          {seniorityMode === "hire_date" && <span className="text-muted-foreground font-normal"> (optional)</span>}
        </Label>
        <Input id="seniority" name="seniority" type="number" min="1" defaultValue={defaultValues?.seniority ?? ""} required={seniorityMode === "manual"} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hireDate">
          Hire Date
          {seniorityMode === "manual" && <span className="text-muted-foreground font-normal"> (optional)</span>}
        </Label>
        <Input id="hireDate" name="hireDate" type="date" defaultValue={defaultValues?.hireDate ?? ""} required={seniorityMode === "hire_date"} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="priorityRank">Priority (same-day tie-breaker, optional)</Label>
        <Input
          id="priorityRank"
          name="priorityRank"
          type="number"
          min="1"
          defaultValue={defaultValues?.priorityRank ?? ""}
          placeholder="Optional — only used when hire dates match; lower takes priority"
        />
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <Select name="roleId" defaultValue={String(defaultValues?.roleId ?? "none")}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="space-y-2">
      <Label>Subclass</Label>
      <Select name="subclassId" defaultValue={String(defaultValues?.subclassId ?? "none")}>
        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {subclasses.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div className="flex items-center space-x-2 pt-2">
      <input type="hidden" name="active" value={activeToggle ? "1" : "0"} />
      <Switch id="active" checked={activeToggle} onCheckedChange={setActiveToggle} defaultChecked={defaultValues?.active ?? true} />
      <Label htmlFor="active">Active Status</Label>
    </div>
    {showStartingHours && (
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="manualStartingHours"
            checked={manualStartingHours}
            onCheckedChange={(checked) => setManualStartingHours(checked === true)}
          />
          <Label htmlFor="manualStartingHours" className="text-sm font-normal cursor-pointer">
            Manually set starting fairness value
          </Label>
        </div>
        {manualStartingHours && (
          <div className="space-y-2 pl-6">
            <Label htmlFor="startingNormalizedHours">Starting Fairness Hours</Label>
            <Input
              id="startingNormalizedHours"
              name="startingNormalizedHours"
              type="number"
              min="0"
              step="0.1"
              defaultValue={defaultValues?.startingNormalizedHours ?? ""}
            />
          </div>
        )}
      </div>
    )}
    <div className="flex justify-end pt-4">
      <Button type="submit" disabled={isPending}>{submitLabel}</Button>
    </div>
  </form>
);

export default function Employees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeRosterId } = useRoster();
  const viewer = isViewer();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [subclassWarningOpen, setSubclassWarningOpen] = useState(false);
  const [pendingEditPayload, setPendingEditPayload] = useState<Record<string, unknown> | null>(null);
  const [activeToggle, setActiveToggle] = useState(true);
  const [manualStartingHours, setManualStartingHours] = useState(false);

  // Add-from-directory state
  const [addTab, setAddTab] = useState<"new" | "existing">("new");
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedSource, setSelectedSource] = useState<Employee | null>(null);
  const [fromDirSeniority, setFromDirSeniority] = useState("");
  const [fromDirHireDate, setFromDirHireDate] = useState("");
  const [fromDirPriority, setFromDirPriority] = useState("");

  const { data: settings } = useGetRosterSettings(activeRosterId ?? 0, {
    query: { queryKey: getGetRosterSettingsQueryKey(activeRosterId ?? 0), enabled: activeRosterId != null },
  });
  const seniorityMode: SeniorityMode = settings?.seniorityMode ?? "manual";

  const { data: employees, isLoading } = useListEmployees(
    { rosterId: activeRosterId ?? undefined },
    {
      query: {
        queryKey: getListEmployeesQueryKey({ rosterId: activeRosterId ?? undefined }),
        enabled: activeRosterId != null,
      },
    }
  );

  const { data: directoryResults = [] } = useListEmployees(
    directorySearch.trim() ? { search: directorySearch.trim() } : undefined,
    {
      query: {
        queryKey: getListEmployeesQueryKey({ search: directorySearch.trim() || undefined }),
        enabled: isCreateOpen && addTab === "existing",
      },
    }
  );
  const directoryOptions = directoryResults.filter((e) => e.rosterId !== activeRosterId);

  const { data: roles = [] } = useListRoles(
    activeRosterId ?? 0,
    { query: { queryKey: getListRolesQueryKey(activeRosterId ?? 0), enabled: activeRosterId != null } }
  );

  const { data: subclasses = [] } = useListSubclasses(
    activeRosterId ?? 0,
    { query: { queryKey: getListSubclassesQueryKey(activeRosterId ?? 0), enabled: activeRosterId != null } }
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({ rosterId: activeRosterId ?? undefined }) });
  };

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        toast({ title: "Employee created" });
        closeCreateDialog();
        invalidate();
      },
      onError: (error) => {
        const data = (error as { data?: { error?: string } } | null)?.data;
        toast({ title: "Error", description: data?.error ?? "Failed to create employee", variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        if (pendingEditPayload) {
          toast({ title: "Subclass updated", description: "Your fairness baseline has been reset and recomputed from your new subclass group." });
          setPendingEditPayload(null);
        } else {
          toast({ title: "Employee updated" });
        }
        setEditingEmp(null);
        invalidate();
      },
      onError: (error) => {
        const data = (error as { data?: { error?: string } } | null)?.data;
        toast({ title: "Error", description: data?.error ?? "Failed to update employee", variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => { toast({ title: "Employee deleted" }); invalidate(); },
      onError: (error) => {
        const data = (error as { data?: { error?: string } } | null)?.data;
        toast({ title: "Error", description: data?.error ?? "Failed to delete employee", variant: "destructive" });
      },
    },
  });

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setAddTab("new");
    setDirectorySearch("");
    setSelectedSource(null);
    setFromDirSeniority("");
    setFromDirHireDate("");
    setFromDirPriority("");
  };

  const pickSourceEmployee = (source: Employee) => {
    setSelectedSource(source);
    setFromDirSeniority(source.seniority != null ? String(source.seniority) : "");
    setFromDirHireDate(source.hireDate ?? "");
    setFromDirPriority(source.priorityRank != null ? String(source.priorityRank) : "");
  };

  const handleCreateFromDirectory = () => {
    if (!activeRosterId || !selectedSource) return;
    const body: Record<string, unknown> = {
      rosterId: activeRosterId,
      name: selectedSource.name,
      linkedEmployeeId: selectedSource.id,
      active: true,
    };
    // Seniority # — required in manual mode, optional in hire_date mode.
    const s = fromDirSeniority.trim() === "" ? null : parseInt(fromDirSeniority, 10);
    if (seniorityMode === "manual" && (s == null || Number.isNaN(s))) {
      toast({ title: "Error", description: "Seniority number is required for this roster", variant: "destructive" });
      return;
    }
    if (s != null && !Number.isNaN(s)) body.seniority = s;
    // Hire Date — required in hire_date mode, optional in manual mode.
    if (seniorityMode === "hire_date" && !fromDirHireDate) {
      toast({ title: "Error", description: "Hire date is required for this roster", variant: "destructive" });
      return;
    }
    if (fromDirHireDate) body.hireDate = fromDirHireDate;
    // Priority — optional same-day tie-breaker.
    const p = fromDirPriority.trim() === "" ? null : parseInt(fromDirPriority, 10);
    if (p !== null && !Number.isNaN(p)) body.priorityRank = p;
    createMutation.mutate({ data: body as any });
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeRosterId) return;
    const fd = new FormData(e.currentTarget);
    const roleId = fd.get("roleId") as string;
    const subclassId = fd.get("subclassId") as string;
    const body: Record<string, unknown> = {
      rosterId: activeRosterId,
      name: fd.get("name") as string,
      roleId: roleId && roleId !== "none" ? parseInt(roleId, 10) : null,
      subclassId: subclassId && subclassId !== "none" ? parseInt(subclassId, 10) : null,
      active: fd.get("active") === "1",
    };
    // Seniority # — required in manual mode, optional in hire_date mode.
    const seniorityRaw = fd.get("seniority") as string;
    const seniorityVal = seniorityRaw && seniorityRaw.trim() !== "" ? parseInt(seniorityRaw, 10) : null;
    if (seniorityMode === "manual" && (seniorityVal == null || Number.isNaN(seniorityVal))) {
      toast({ title: "Error", description: "Seniority number is required for this roster", variant: "destructive" });
      return;
    }
    if (seniorityVal != null) body.seniority = seniorityVal;
    // Hire Date — required in hire_date mode, optional in manual mode.
    const hireDateRaw = fd.get("hireDate") as string;
    if (seniorityMode === "hire_date" && !hireDateRaw) {
      toast({ title: "Error", description: "Hire date is required for this roster", variant: "destructive" });
      return;
    }
    if (hireDateRaw) body.hireDate = hireDateRaw;
    // Priority — optional same-day tie-breaker.
    const priorityRaw = fd.get("priorityRank") as string;
    if (priorityRaw && priorityRaw.trim() !== "") body.priorityRank = parseInt(priorityRaw, 10);
    if (manualStartingHours) {
      const raw = fd.get("startingNormalizedHours") as string;
      if (raw && raw.trim() !== "") {
        body.startingNormalizedHours = parseFloat(raw);
      }
    }
    createMutation.mutate({ data: body as any });
  };

  const buildEditPayload = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const roleId = fd.get("roleId") as string;
    const subclassId = fd.get("subclassId") as string;
    const payload: Record<string, unknown> = {
      name: fd.get("name") as string,
      roleId: roleId && roleId !== "none" ? parseInt(roleId, 10) : null,
      subclassId: subclassId && subclassId !== "none" ? parseInt(subclassId, 10) : null,
      active: fd.get("active") === "1",
    };
    // All three are always editable; the roster mode only sets which is required
    // (enforced by the form's `required` attribute + backend). The form is
    // pre-filled with current values, so reading them back preserves or updates.
    const seniorityRaw = fd.get("seniority") as string;
    payload.seniority = seniorityRaw && seniorityRaw.trim() !== "" ? parseInt(seniorityRaw, 10) : null;
    const hireDateRaw = fd.get("hireDate") as string;
    payload.hireDate = hireDateRaw || null;
    const priorityRaw = fd.get("priorityRank") as string;
    payload.priorityRank = priorityRaw && priorityRaw.trim() !== "" ? parseInt(priorityRaw, 10) : null;
    return payload;
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEmp) return;
    const payload = buildEditPayload(e);
    const newSubclassId = (payload.subclassId as number | null) ?? null;

    // Check if subclass is changing
    const oldSubclassId = editingEmp.subclassId ?? null;
    if (newSubclassId !== oldSubclassId) {
      setPendingEditPayload(payload);
      setSubclassWarningOpen(true);
      setActiveToggle(editingEmp.active);
      return;
    }

    updateMutation.mutate({ id: editingEmp.id, data: payload as any });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage roster, seniority, and active status.</p>
        </div>

        {!viewer && (
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              if (open) setIsCreateOpen(true);
              else closeCreateDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!activeRosterId}>
                <PlusCircle className="w-4 h-4" /> Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
              <Tabs value={addTab} onValueChange={(v) => { setAddTab(v as "new" | "existing"); setSelectedSource(null); }}>
                <TabsList className="w-full">
                  <TabsTrigger value="new" className="flex-1">New Employee</TabsTrigger>
                  <TabsTrigger value="existing" className="flex-1">From Directory</TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="mt-4">
                  <EmployeeForm
                    onSubmit={handleCreate}
                    isPending={createMutation.isPending}
                    submitLabel="Save Employee"
                    seniorityMode={seniorityMode}
                    showStartingHours
                    roles={roles}
                    subclasses={subclasses}
                    manualStartingHours={manualStartingHours}
                    setManualStartingHours={setManualStartingHours}
                    activeToggle={activeToggle}
                    setActiveToggle={setActiveToggle}
                  />
                </TabsContent>
                <TabsContent value="existing" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="directory-search">Search all rosters</Label>
                    <Input
                      id="directory-search"
                      placeholder="Type a name…"
                      value={directorySearch}
                      onChange={(e) => { setDirectorySearch(e.target.value); setSelectedSource(null); }}
                    />
                  </div>
                  {selectedSource ? (
                    <div className="space-y-4 rounded-md border p-4">
                      <div className="text-sm">
                        Adding <span className="font-semibold">{selectedSource.name}</span>
                        {" "}from <span className="font-medium">{selectedSource.rosterName}</span> to this roster.
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="from-dir-seniority">
                            Seniority #
                            {seniorityMode === "hire_date" && <span className="text-muted-foreground font-normal"> (optional)</span>}
                          </Label>
                          <Input
                            id="from-dir-seniority"
                            type="number"
                            min="1"
                            value={fromDirSeniority}
                            required={seniorityMode === "manual"}
                            onChange={(e) => setFromDirSeniority(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="from-dir-hiredate">
                            Hire Date
                            {seniorityMode === "manual" && <span className="text-muted-foreground font-normal"> (optional)</span>}
                          </Label>
                          <Input
                            id="from-dir-hiredate"
                            type="date"
                            value={fromDirHireDate}
                            required={seniorityMode === "hire_date"}
                            onChange={(e) => setFromDirHireDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="from-dir-priority">Priority (optional)</Label>
                          <Input
                            id="from-dir-priority"
                            type="number"
                            min="1"
                            value={fromDirPriority}
                            onChange={(e) => setFromDirPriority(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setSelectedSource(null)}>Back</Button>
                        <Button onClick={handleCreateFromDirectory} disabled={createMutation.isPending}>
                          Add to Roster
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                      {directorySearch.trim() === "" ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          Type a name to search across all rosters.
                        </div>
                      ) : directoryOptions.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          No employees found in other rosters.
                        </div>
                      ) : (
                        directoryOptions.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                            onClick={() => pickSourceEmployee(emp)}
                          >
                            <span className="font-medium">{emp.name}</span>
                            <span className="text-sm text-muted-foreground">{emp.rosterName}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!editingEmp} onOpenChange={(open) => !open && setEditingEmp(null)}>
        <DialogContent key={editingEmp?.id}>
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          {editingEmp && (
            <EmployeeForm
              defaultValues={editingEmp}
              onSubmit={handleEdit}
              isPending={updateMutation.isPending}
              submitLabel="Update Employee"
              seniorityMode={seniorityMode}
              roles={roles}
              subclasses={subclasses}
              manualStartingHours={manualStartingHours}
              setManualStartingHours={setManualStartingHours}
              activeToggle={activeToggle}
              setActiveToggle={setActiveToggle}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={subclassWarningOpen} onOpenChange={setSubclassWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change subclass?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing an employee's subclass will reset their fairness baseline to 0 and recompute it from their new subclass group. This ensures fair rotation within the new group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!editingEmp || !pendingEditPayload) return;
                setSubclassWarningOpen(false);
                updateMutation.mutate({ id: editingEmp.id, data: pendingEditPayload as any });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="overflow-hidden border-border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium text-center">Seniority</th>
                  <th className="px-6 py-4 font-medium text-center">Hired</th>
                  <th className="px-6 py-4 font-medium text-center">Role</th>
                  <th className="px-6 py-4 font-medium text-center">Subclass</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Offered Hours</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : !employees?.length ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                      {activeRosterId ? "No employees found. Add one to get started." : "Select a roster to view employees."}
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <Link href={`/employees/${emp.id}/report`} className="text-primary hover:underline font-semibold">
                          {emp.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-center tabular-nums font-mono text-muted-foreground">
                        {emp.effectiveSeniority != null ? `#${emp.effectiveSeniority}` : "—"}
                      </td>
                      <td className="px-6 py-4 text-center text-muted-foreground">
                        {emp.hireDate ?? "—"}
                        {emp.priorityRank != null && (
                          <span className="ml-1 text-xs">P{emp.priorityRank}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {emp.roleName ? (
                          <Badge variant="outline" className="font-normal bg-background">{emp.roleName}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {emp.subclassName ? (
                          <Badge variant="secondary" className="font-normal">{emp.subclassName}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {emp.active ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600 shadow-none border-0 font-medium">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-medium">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums font-medium">
                        {emp.totalOfferedHours}h
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!viewer && (
                              <>
                                <DropdownMenuItem onClick={() => setEditingEmp(emp)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (confirm("Delete this employee? This cannot be undone.")) {
                                      deleteMutation.mutate({ id: emp.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
