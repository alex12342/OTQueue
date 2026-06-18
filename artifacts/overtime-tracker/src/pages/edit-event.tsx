import React, { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useGetEvent,
  getGetEventQueryKey,
  useUpdateEvent,
  getListEventsQueryKey,
  getGetUpNextQueryKey,
  getGetStatsQueryKey,
  useListDayTypeConfig,
  getListDayTypeConfigQueryKey,
} from "@workspace/api-client-react";
import { useRoster } from "@/hooks/use-roster";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type EntryState = {
  employeeId: number;
  offered: boolean;
  worked: boolean;
  hoursOverride: string;
};

export default function EditEvent() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const eventId = parseInt(params.id, 10);

  const [initialized, setInitialized] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState("");
  const [defaultHours, setDefaultHours] = useState("4");
  const [dayType, setDayType] = useState<string>("weekday");
  const [entries, setEntries] = useState<Record<number, EntryState>>({});

  const { data: event, isLoading: eventLoading } = useGetEvent(eventId, {
    query: { queryKey: getGetEventQueryKey(eventId) },
  });

  const { activeRosterId } = useRoster();

  const { data: dayTypeConfigs } = useListDayTypeConfig(activeRosterId ?? 0, {
    query: {
      queryKey: getListDayTypeConfigQueryKey(activeRosterId ?? 0),
      enabled: activeRosterId != null,
    },
  });

  const { data: employees, isLoading: employeesLoading } = useListEmployees(
    { rosterId: activeRosterId ?? undefined },
    { query: { queryKey: getListEmployeesQueryKey({ rosterId: activeRosterId ?? undefined }) } }
  );

  const isLoading = eventLoading || employeesLoading;

  // Pre-populate form once event data arrives
  React.useEffect(() => {
    if (!event || initialized) return;
    setDate(parseISO(event.date));
    setDescription(event.description);
    setDefaultHours(String(event.defaultHours));
    setDayType(event.dayType ?? "weekday");

    const preloaded: Record<number, EntryState> = {};
    for (const entry of event.entries ?? []) {
      preloaded[entry.employeeId] = {
        employeeId: entry.employeeId,
        offered: entry.offered,
        worked: entry.worked,
        hoursOverride: entry.hoursOverride != null ? String(entry.hoursOverride) : "",
      };
    }
    setEntries(preloaded);
    setInitialized(true);
  }, [event, initialized]);

  const activeEmployees = React.useMemo(() => {
    if (!employees) return [];
    // Include all active employees, plus any inactive employees that appeared in this event
    const eventEmployeeIds = new Set((event?.entries ?? []).map((e) => e.employeeId));
    return employees
      .filter((e) => e.active || eventEmployeeIds.has(e.id))
      .sort((a, b) => a.seniority - b.seniority);
  }, [employees, event]);

  const updateMutation = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event updated", description: "Changes saved successfully." });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ rosterId: activeRosterId ?? 0, dayType: "weekday" }) });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ rosterId: activeRosterId ?? 0, dayType: "weekend" }) });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ rosterId: activeRosterId ?? 0, dayType: "holiday" }) });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        setLocation("/log");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update event.", variant: "destructive" });
      },
    },
  });

  const handleEntryChange = (empId: number, field: keyof EntryState, value: boolean | string) => {
    setEntries((prev) => {
      const current = prev[empId] || { employeeId: empId, offered: false, worked: false, hoursOverride: "" };
      const next = { ...current, [field]: value };
      if (field === "worked" && value === true) next.offered = true;
      return { ...prev, [empId]: next };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const activeEntries = Object.values(entries).filter((e) => e.offered || e.worked);
    if (activeEntries.length === 0) {
      toast({ title: "Validation Error", description: "At least one employee must be checked as offered or worked.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Validation Error", description: "Description is required.", variant: "destructive" });
      return;
    }

    updateMutation.mutate({
      id: eventId,
      data: {
        rosterId: event?.rosterId ?? activeRosterId ?? 0,
        date: format(date, "yyyy-MM-dd"),
        description,
        defaultHours: parseFloat(defaultHours) || 0,
        dayType,
        entries: activeEntries.map((e) => ({
          employeeId: e.employeeId,
          offered: e.offered,
          worked: e.worked,
          hoursOverride: e.hoursOverride ? parseFloat(e.hoursOverride) : null,
        })),
      },
    });
  };

  if (eventLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!event && !eventLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">Event Not Found</h1>
        <p className="text-muted-foreground">This event does not exist or was deleted.</p>
        <Link href="/log">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Log
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/log">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Event</h1>
          <p className="text-muted-foreground mt-1">Update the details or roster assignments for this event.</p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-lg">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal bg-background", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g. Line 4 Cleanup, Sick Coverage"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Default Hours</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0"
                value={defaultHours}
                onChange={(e) => setDefaultHours(e.target.value)}
                className="bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Day Type</Label>
              <Select value={dayType} onValueChange={(v: string) => setDayType(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(dayTypeConfigs ?? [])
                    .filter((c) => c.enabled)
                    .map((c) => (
                      <SelectItem key={c.dayType} value={c.dayType}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-lg">Roster Assignments</CardTitle>
          <CardDescription>Update who was offered and who actually worked.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                <tr>
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium text-center">Offered</th>
                  <th className="px-6 py-3 font-medium text-center">Worked</th>
                  <th className="px-6 py-3 font-medium">Override Hrs (Opt)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-5 mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-5 mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-9 w-24" /></td>
                    </tr>
                  ))
                ) : !activeEmployees.length ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      No active employees available in the roster.
                    </td>
                  </tr>
                ) : (
                  activeEmployees.map((emp) => {
                    const entry = entries[emp.id] || { offered: false, worked: false, hoursOverride: "" };
                    return (
                      <tr
                        key={emp.id}
                        className={cn("hover:bg-muted/10 transition-colors", (entry.offered || entry.worked) && "bg-primary/5 hover:bg-primary/10")}
                      >
                        <td className="px-6 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-mono text-xs w-6 inline-block">#{emp.seniority}</span>
                            {emp.name}
                            {!emp.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Checkbox
                            checked={entry.offered}
                            onCheckedChange={(c) => handleEntryChange(emp.id, "offered", !!c)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                            data-testid={`checkbox-offered-${emp.id}`}
                          />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Checkbox
                            checked={entry.worked}
                            onCheckedChange={(c) => handleEntryChange(emp.id, "worked", !!c)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                            data-testid={`checkbox-worked-${emp.id}`}
                          />
                        </td>
                        <td className="px-6 py-3">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder={entry.worked ? defaultHours : "-"}
                            value={entry.hoursOverride}
                            onChange={(e) => handleEntryChange(emp.id, "hoursOverride", e.target.value)}
                            disabled={!entry.worked && !entry.offered}
                            className="w-24 h-9 bg-background disabled:opacity-50"
                            data-testid={`input-hours-override-${emp.id}`}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center pt-4 pb-12">
        <Link href="/log">
          <Button type="button" variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          size="lg"
          className="px-8 gap-2 font-bold"
          disabled={updateMutation.isPending || isLoading}
          data-testid="button-submit-edit-event"
        >
          <Save className="w-5 h-5" />
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
