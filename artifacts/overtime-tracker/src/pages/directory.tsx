import React, { useMemo, useState } from "react";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateEmployee,
  useListRosters,
  useGetRosterSettings,
  getGetRosterSettingsQueryKey,
} from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Search } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isViewer } from "@/lib/auth";

type Person = {
  id: string;
  name: string;
  primary: Employee;
  records: Employee[];
  rosterIds: Set<number>;
};

/**
 * Group employee records into "people". A person is a connected component of
 * records linked via `linkedEmployeeId` (a record in one roster points back to
 * its source record in another roster). Records that are not linked to anything
 * form a person of one. Two people who merely share a name stay separate.
 */
function buildPeople(employees: Employee[]): Person[] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let root = x;
    while (parent.get(root) !== root) {
      if (!parent.has(root)) {
        parent.set(root, root);
        break;
      }
      root = parent.get(root) as number;
    }
    while (parent.get(x) !== root) {
      const next = parent.get(x) as number;
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const e of employees) {
    if (e.linkedEmployeeId != null) union(e.id, e.linkedEmployeeId);
  }

  const groups = new Map<number, Employee[]>();
  for (const e of employees) {
    const root = find(e.id);
    const arr = groups.get(root) ?? [];
    arr.push(e);
    groups.set(root, arr);
  }

  const people: Person[] = [];
  for (const recs of groups.values()) {
    recs.sort((a, b) => a.id - b.id);
    const primary = recs.find((r) => r.linkedEmployeeId == null) ?? recs[0];
    people.push({
      id: `person-${recs[0].id}`,
      name: primary.name,
      primary,
      records: recs,
      rosterIds: new Set(recs.map((r) => r.rosterId)),
    });
  }
  people.sort((a, b) => a.name.localeCompare(b.name));
  return people;
}

export default function Directory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const viewer = isViewer();

  const [search, setSearch] = useState("");
  const [addPerson, setAddPerson] = useState<Person | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [targetRosterId, setTargetRosterId] = useState<number | "">("");
  const [fSeniority, setFSeniority] = useState("");
  const [fHireDate, setFHireDate] = useState("");
  const [fPriority, setFPriority] = useState("");

  const searchKey = search.trim() || undefined;

  const { data: employees = [], isLoading } = useListEmployees(
    searchKey ? { search: searchKey } : undefined,
    { query: { queryKey: getListEmployeesQueryKey({ search: searchKey }) } }
  );

  const { data: rosters = [] } = useListRosters();

  const people = useMemo(() => buildPeople(employees), [employees]);

  const hasTargetRoster = typeof targetRosterId === "number";
  const targetSettingsId = hasTargetRoster ? (targetRosterId as number) : 0;
  const { data: targetSettings } = useGetRosterSettings(targetSettingsId, {
    query: {
      queryKey: getGetRosterSettingsQueryKey(targetSettingsId),
      enabled: hasTargetRoster,
    },
  });
  const targetMode: "manual" | "hire_date" = targetSettings?.seniorityMode ?? "manual";

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        toast({ title: "Employee added to roster" });
        closeAdd();
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({ search: searchKey }) });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
      onError: (error) => {
        const data = (error as { data?: { error?: string } } | null)?.data;
        toast({ title: "Error", description: data?.error ?? "Failed to add employee to roster", variant: "destructive" });
      },
    },
  });

  const closeAdd = () => {
    setAddOpen(false);
    setAddPerson(null);
    setTargetRosterId("");
    setFSeniority("");
    setFHireDate("");
    setFPriority("");
  };

  const openAdd = (person: Person) => {
    setAddPerson(person);
    const src = person.primary;
    setTargetRosterId("");
    setFSeniority(src.seniority != null ? String(src.seniority) : "");
    setFHireDate(src.hireDate ?? "");
    setFPriority(src.priorityRank != null ? String(src.priorityRank) : "");
    setAddOpen(true);
  };

  const confirmAdd = () => {
    if (!addPerson || !hasTargetRoster) return;
    const src = addPerson.primary;
    const body: Record<string, unknown> = {
      rosterId: targetRosterId,
      name: src.name,
      linkedEmployeeId: src.id,
      active: true,
    };
    if (targetMode === "manual") {
      const s = parseInt(fSeniority, 10);
      if (Number.isNaN(s)) {
        toast({ title: "Error", description: "Seniority number is required for this roster", variant: "destructive" });
        return;
      }
      body.seniority = s;
    } else {
      if (!fHireDate) {
        toast({ title: "Error", description: "Hire date is required for this roster", variant: "destructive" });
        return;
      }
      body.hireDate = fHireDate;
      const p = fPriority.trim() === "" ? null : parseInt(fPriority, 10);
      if (p !== null && !Number.isNaN(p)) body.priorityRank = p;
    }
    createMutation.mutate({ data: body as any });
  };

  const allRostersAssigned = (person: Person) => person.rosterIds.size >= rosters.length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Directory</h1>
        <p className="text-muted-foreground mt-1">
          Every person across all rosters, shown once with the roster or rosters they are assigned to.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search all rosters by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="directory-search"
        />
      </div>

      <Card className="overflow-hidden border-border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Rosters</th>
                    {!viewer && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {people.length === 0 ? (
                    <tr>
                      <td colSpan={viewer ? 2 : 3} className="px-6 py-8 text-center text-muted-foreground">
                        {search ? "No employees match your search." : "No employees found yet."}
                      </td>
                    </tr>
                  ) : (
                    people.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 font-medium">
                          <Link href={`/employees/${p.primary.id}/report`} className="text-primary hover:underline font-semibold">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {p.records.map((r) => (
                              <Link
                                key={r.id}
                                href={`/employees/${r.id}/report`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs hover:bg-secondary transition-colors"
                              >
                                <span className="font-medium text-foreground">{r.rosterName}</span>
                                {r.hireDate && <span className="text-muted-foreground">· {r.hireDate}</span>}
                                {r.effectiveSeniority != null && (
                                  <span className="text-muted-foreground">#{r.effectiveSeniority}</span>
                                )}
                                <Badge
                                  variant={r.active ? "outline" : "secondary"}
                                  className="h-4 px-1.5 py-0 text-[10px] font-medium"
                                >
                                  {r.active ? "Active" : "Inactive"}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        </td>
                        {!viewer && (
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              disabled={allRostersAssigned(p)}
                              title={allRostersAssigned(p) ? "Already in every roster" : undefined}
                              onClick={() => openAdd(p)}
                            >
                              <PlusCircle className="h-3.5 w-3.5" /> Add to roster
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!viewer && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Use "Add to roster" to assign a person to another roster — their hours, subclass, and role stay independent
            per roster. Rosters they are already in are marked and can&rsquo;t be re-added.
          </p>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(open) => !open && closeAdd()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to another roster</DialogTitle>
            <CardDescription>
              {addPerson?.name} will be added to the selected roster with their details pre-filled. Their record there is
              independent.
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Target roster</Label>
              <Select
                value={String(targetRosterId ?? "")}
                onValueChange={(v) => setTargetRosterId(v === "" ? "" : parseInt(v, 10))}
              >
                <SelectTrigger data-testid="target-roster-select">
                  <SelectValue placeholder="Select a roster" />
                </SelectTrigger>
                <SelectContent>
                  {rosters.map((r) => {
                    const alreadyIn = addPerson?.rosterIds.has(r.id);
                    return (
                      <SelectItem key={r.id} value={String(r.id)} disabled={alreadyIn}>
                        {r.name}
                        {alreadyIn ? " — already in" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {addPerson && allRostersAssigned(addPerson) && (
                <p className="text-xs text-muted-foreground">{addPerson.name} is already in every roster.</p>
              )}
            </div>
            {hasTargetRoster && (
              targetMode === "manual" ? (
                <div className="space-y-2">
                  <Label htmlFor="add-seniority">Seniority #</Label>
                  <Input
                    id="add-seniority"
                    type="number"
                    min="1"
                    value={fSeniority}
                    onChange={(e) => setFSeniority(e.target.value)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-hiredate">Hire Date</Label>
                    <Input id="add-hiredate" type="date" value={fHireDate} onChange={(e) => setFHireDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-priority">Priority (optional)</Label>
                    <Input id="add-priority" type="number" min="1" value={fPriority} onChange={(e) => setFPriority(e.target.value)} />
                  </div>
                </div>
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdd}>Cancel</Button>
            <Button
              onClick={confirmAdd}
              disabled={createMutation.isPending || !hasTargetRoster}
            >
              Add to Roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
