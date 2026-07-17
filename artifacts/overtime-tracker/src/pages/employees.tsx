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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useRoster } from "@/hooks/use-roster";
import { Checkbox } from "@/components/ui/checkbox";

export default function Employees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeRosterId } = useRoster();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [subclassWarningOpen, setSubclassWarningOpen] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<{subclassId: number | null; active: boolean} | null>(null);
  const [activeToggle, setActiveToggle] = useState(true);
  const [manualStartingHours, setManualStartingHours] = useState(false);

  const { data: employees, isLoading } = useListEmployees(
    { rosterId: activeRosterId ?? undefined },
    {
      query: {
        queryKey: getListEmployeesQueryKey({ rosterId: activeRosterId ?? undefined }),
        enabled: activeRosterId != null,
      },
    }
  );

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
      onSuccess: () => { toast({ title: "Employee created" }); setIsCreateOpen(false); invalidate(); },
      onError: () => toast({ title: "Error", description: "Failed to create employee", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        if (pendingEditData) {
          toast({ title: "Subclass updated", description: "Your fairness baseline has been reset and recomputed from your new subclass group." });
          setPendingEditData(null);
        } else {
          toast({ title: "Employee updated" });
        }
        setEditingEmp(null);
        invalidate();
      },
      onError: () => toast({ title: "Error", description: "Failed to update employee", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => { toast({ title: "Employee deleted" }); invalidate(); },
      onError: () => toast({ title: "Error", description: "Failed to delete employee", variant: "destructive" }),
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeRosterId) return;
    const fd = new FormData(e.currentTarget);
    const roleId = fd.get("roleId") as string;
    const subclassId = fd.get("subclassId") as string;
    const body: Record<string, unknown> = {
      rosterId: activeRosterId,
      name: fd.get("name") as string,
      seniority: parseInt(fd.get("seniority") as string, 10),
      roleId: roleId && roleId !== "none" ? parseInt(roleId, 10) : null,
      subclassId: subclassId && subclassId !== "none" ? parseInt(subclassId, 10) : null,
      active: fd.get("active") === "1",
    };
    if (manualStartingHours) {
      const raw = fd.get("startingNormalizedHours") as string;
      if (raw && raw.trim() !== "") {
        body.startingNormalizedHours = parseFloat(raw);
      }
    }
    createMutation.mutate({ data: body as any });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEmp) return;
    const fd = new FormData(e.currentTarget);
    const roleId = fd.get("roleId") as string;
    const subclassId = fd.get("subclassId") as string;
    const newSubclassId = subclassId && subclassId !== "none" ? parseInt(subclassId, 10) : null;

    // Check if subclass is changing
    const oldSubclassId = editingEmp.subclassId ?? null;
    if (newSubclassId !== oldSubclassId) {
      setPendingEditData({ subclassId: newSubclassId, active: activeToggle });
      setSubclassWarningOpen(true);
      setActiveToggle(editingEmp.active);
      return;
    }

    updateMutation.mutate({
      id: editingEmp.id,
      data: {
        name: fd.get("name") as string,
        seniority: parseInt(fd.get("seniority") as string, 10),
        roleId: roleId && roleId !== "none" ? parseInt(roleId, 10) : null,
        subclassId: newSubclassId,
        active: fd.get("active") === "1",
      },
    });
  };

  const EmployeeForm = ({
    defaultValues,
    onSubmit,
    isPending,
    submitLabel,
    showStartingHours = false,
  }: {
    defaultValues?: Partial<Employee>;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isPending: boolean;
    submitLabel: string;
    showStartingHours?: boolean;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="seniority">Seniority #</Label>
          <Input id="seniority" name="seniority" type="number" min="1" defaultValue={defaultValues?.seniority} required />
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage roster, seniority, and active status.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!activeRosterId}>
              <PlusCircle className="w-4 h-4" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
            <EmployeeForm
              onSubmit={handleCreate}
              isPending={createMutation.isPending}
              submitLabel="Save Employee"
              showStartingHours
            />
          </DialogContent>
        </Dialog>
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
                if (!editingEmp || !pendingEditData) return;
                setSubclassWarningOpen(false);
                updateMutation.mutate({
                  id: editingEmp.id,
                  data: {
                    name: editingEmp.name,
                    seniority: editingEmp.seniority,
                    roleId: editingEmp.roleId,
                    subclassId: pendingEditData.subclassId,
                    active: pendingEditData.active,
                  },
                });
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
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : !employees?.length ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
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
                        #{emp.seniority}
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
