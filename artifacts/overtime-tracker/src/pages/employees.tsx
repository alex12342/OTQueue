import React, { useState } from "react";
import { 
  useListEmployees, 
  getListEmployeesQueryKey, 
  useCreateEmployee, 
  useUpdateEmployee, 
  useDeleteEmployee 
} from "@workspace/api-client-react";
import { Employee, EmployeeCategory } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

export default function Employees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const { data: employees, isLoading } = useListEmployees({
    query: { queryKey: getListEmployeesQueryKey() }
  });

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        toast({ title: "Employee created" });
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to create employee", variant: "destructive" })
    }
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        toast({ title: "Employee updated" });
        setEditingEmp(null);
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to update employee", variant: "destructive" })
    }
  });

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        toast({ title: "Employee deleted" });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to delete employee", variant: "destructive" })
    }
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      data: {
        name: fd.get("name") as string,
        seniority: parseInt(fd.get("seniority") as string, 10),
        category: fd.get("category") as any,
        active: fd.get("active") === "on",
      }
    });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEmp) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editingEmp.id,
      data: {
        name: fd.get("name") as string,
        seniority: parseInt(fd.get("seniority") as string, 10),
        category: fd.get("category") as any,
        active: fd.get("active") === "on",
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage roster, seniority, and active status.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="w-4 h-4" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seniority">Seniority #</Label>
                  <Input id="seniority" name="seniority" type="number" min="1" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="four_hour">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="four_hour">4-Hour</SelectItem>
                      <SelectItem value="full_time">Full Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="active" name="active" defaultChecked />
                <Label htmlFor="active">Active Status</Label>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createMutation.isPending}>Save Employee</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editingEmp} onOpenChange={(open) => !open && setEditingEmp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {editingEmp && (
            <form onSubmit={handleEdit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input id="edit-name" name="name" defaultValue={editingEmp.name} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-seniority">Seniority #</Label>
                  <Input id="edit-seniority" name="seniority" type="number" min="1" defaultValue={editingEmp.seniority} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select name="category" defaultValue={editingEmp.category}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="four_hour">4-Hour</SelectItem>
                      <SelectItem value="full_time">Full Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="edit-active" name="active" defaultChecked={editingEmp.active} />
                <Label htmlFor="edit-active">Active Status</Label>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={updateMutation.isPending}>Update Employee</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden border-border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium text-center">Seniority</th>
                  <th className="px-6 py-4 font-medium text-center">Category</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Offered Hours</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-12 mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-20 mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-16 mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-8 w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : !employees?.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No employees found. Add one to get started.
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
                        <Badge variant="outline" className="font-normal bg-background">
                          {emp.category === "full_time" ? "Full Time" : "4-Hour"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {emp.active ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600 shadow-none border-0 font-medium">Active</Badge>
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
                                if (confirm("Delete this employee? This will break their event history.")) {
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
