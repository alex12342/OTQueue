import React, { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetEmployeeReport,
  getGetEmployeeReportQueryKey,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Clock, History, BarChart, CheckCircle2, Pencil, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format as formatDate } from "date-fns";

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EmployeeReport() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empId = parseInt(id, 10);

  const [editOpen, setEditOpen] = useState(false);
  const [editActive, setEditActive] = useState(true);

  const { data: report, isLoading, error } = useGetEmployeeReport(empId, {
    query: {
      queryKey: getGetEmployeeReportQueryKey(empId),
      enabled: !!id,
    },
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        toast({ title: "Employee updated" });
        setEditOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetEmployeeReportQueryKey(empId) });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to update employee", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        toast({ title: "Employee removed" });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setLocation("/employees");
      },
      onError: () => toast({ title: "Error", description: "Failed to delete employee", variant: "destructive" }),
    },
  });

  const handleExport = () => {
    if (!report) return;
    const header = ["Date", "Event Description", "Status", "Hours Override", "Hours Offered", "Hours Awarded"];
    const rows: string[][] = [header];
    for (const evt of report.events ?? []) {
      const status = evt.worked ? "Worked" : evt.offered ? "Declined" : "";
      rows.push([
        evt.date,
        evt.description,
        status,
        evt.hoursOverride != null ? String(evt.hoursOverride) : "",
        String(evt.hoursOffered),
        String(evt.hoursAwarded),
      ]);
    }
    const name = report.employee.name.replace(/\s+/g, "-").toLowerCase();
    downloadCsv(`otqueue-report-${name}-${formatDate(new Date(), "yyyy-MM-dd")}.csv`, rows);
    toast({ title: "Export ready", description: `${report.events.length} event(s) exported.` });
  };

  const openEdit = () => {
    if (!report?.employee) return;
    setEditActive(report.employee.active);
    setEditOpen(true);
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: empId,
      data: {
        name: fd.get("name") as string,
        seniority: parseInt(fd.get("seniority") as string, 10),
        active: editActive,
      },
    });
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive">Error Loading Report</h2>
        <p className="text-muted-foreground mt-2">Could not find employee details.</p>
        <Link href="/employees" className="text-primary hover:underline mt-4 inline-block">
          Return to Roster
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/employees" className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {isLoading ? <Skeleton className="h-8 w-48" /> : report?.employee.name}
            </h1>
            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <>
                  <Badge variant={report?.employee.active ? "outline" : "secondary"}>
                    {report?.employee.active ? "Active" : "Inactive"}
                  </Badge>
                  <span>&bull;</span>
                  <span>Seniority #{report?.employee.seniority}</span>
                  <span>&bull;</span>
                  {report?.employee.subclassName && <span>{report.employee.subclassName}</span>}
                  {report?.employee.roleName && <span className="italic">{report.employee.roleName}</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {!isLoading && report?.employee && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExport}
              disabled={!report.events?.length}
              data-testid="button-export-report"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={openEdit}
              data-testid="button-edit-employee"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  data-testid="button-delete-employee"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {report.employee.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the employee. Their past event entries will remain in the log but they will no longer appear in the rotation. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate({ id: empId })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove Employee
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {report?.employee && (
            <form onSubmit={handleEdit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input id="edit-name" name="name" defaultValue={report.employee.name} required data-testid="input-edit-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-seniority">Seniority #</Label>
                  <Input
                    id="edit-seniority"
                    name="seniority"
                    type="number"
                    min="1"
                    defaultValue={report.employee.seniority}
                    required
                    data-testid="input-edit-seniority"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="edit-active"
                  checked={editActive}
                  onCheckedChange={setEditActive}
                  data-testid="switch-edit-active"
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-employee">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Offered</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-3xl font-bold text-foreground">{report?.totalOfferedHours}h</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Worked</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-3xl font-bold text-primary">{report?.totalWorkedHours}h</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acceptance Rate</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-3xl font-bold text-foreground">
                {report?.acceptanceRate != null ? `${report.acceptanceRate.toFixed(1)}%` : "-"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border shadow-sm mt-8">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Overtime History</CardTitle>
          </div>
          <CardDescription>Chronological list of all events offered to this employee.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Event Description</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Awarded</th>
                  <th className="px-6 py-4 font-medium text-right">Applied to Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-16 mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : !report?.events?.length ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No event history found for this employee.
                    </td>
                  </tr>
                ) : (
                  report.events.map((evt) => (
                    <tr key={evt.eventId} className="hover:bg-muted/10">
                      <td className="px-6 py-4 font-medium text-muted-foreground tabular-nums">
                        {format(new Date(evt.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">{evt.description}</td>
                      <td className="px-6 py-4 text-center">
                        {evt.worked ? (
                          <Badge className="bg-primary/10 text-primary border-0 shadow-none">Worked</Badge>
                        ) : evt.offered ? (
                          <Badge variant="outline" className="text-muted-foreground">Declined</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {evt.hoursAwarded ? (
                          <span className="font-semibold">{evt.hoursAwarded}h</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums font-mono text-muted-foreground">
                        +{evt.hoursOffered}h
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
