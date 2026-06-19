import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateEvent,
  getGetUpNextQueryKey,
  getListEventsQueryKey,
  getGetStatsQueryKey,
  useSuggestDayType,
  useListDayTypeConfig,
  getListDayTypeConfigQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRoster } from "@/hooks/use-roster";

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

export default function LogEvent() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { activeRosterId } = useRoster();

  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState("");
  const [defaultHours, setDefaultHours] = useState("4");
  const [dayType, setDayType] = useState<string>("weekday");
  const [dayTypeOverridden, setDayTypeOverridden] = useState(false);
  const [multiplier, setMultiplier] = useState("1");

  const [entries, setEntries] = useState<Record<number, EntryState>>({});

  const dateStr = format(date, "yyyy-MM-dd");

  const { data: suggestion } = useSuggestDayType(
    { date: dateStr },
    { query: { queryKey: ["/api/suggest-day-type", dateStr], enabled: !!dateStr } }
  );

  const { data: dayTypeConfigs } = useListDayTypeConfig(activeRosterId ?? 0, {
    query: {
      queryKey: getListDayTypeConfigQueryKey(activeRosterId ?? 0),
      enabled: activeRosterId != null,
    },
  });

  // When suggestion arrives, pick the best matching enabled day type key
  useEffect(() => {
    if (suggestion && !dayTypeOverridden && dayTypeConfigs) {
      const suggested = suggestion.suggestedDayType;
      const enabledTypes = dayTypeConfigs.filter((c) => c.enabled);
      const exact = enabledTypes.find((c) => c.dayType === suggested);
      if (exact) {
        setDayType(exact.dayType);
      } else if (enabledTypes.length > 0) {
        setDayType(enabledTypes[0].dayType);
      }
    }
  }, [suggestion, dayTypeOverridden, dayTypeConfigs]);

  useEffect(() => {
    if (dayTypeConfigs) {
      const config = dayTypeConfigs.find((c) => c.dayType === dayType);
      setMultiplier(config?.multiplier != null ? String(config.multiplier) : "1");
    }
  }, [dayType, dayTypeConfigs]);

  const handleDateChange = (d: Date | undefined) => {
    if (d) {
      setDate(d);
      setDayTypeOverridden(false);
    }
  };

  const { data: employees, isLoading } = useListEmployees(
    { rosterId: activeRosterId ?? undefined },
    {
      query: {
        queryKey: getListEmployeesQueryKey({ rosterId: activeRosterId ?? undefined }),
        enabled: activeRosterId != null,
      },
    }
  );

  const activeEmployees = React.useMemo(
    () => (employees || []).filter((e) => e.active).sort((a, b) => a.seniority - b.seniority),
    [employees]
  );

  const createMutation = useCreateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Success", description: "Overtime event logged successfully." });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ rosterId: activeRosterId ?? 0, dayType: "weekday" }) });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ rosterId: activeRosterId ?? 0, dayType: "weekend" }) });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ rosterId: activeRosterId ?? 0, dayType: "holiday" }) });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        setLocation("/log");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to log event.", variant: "destructive" });
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
    if (!activeRosterId) {
      toast({ title: "No roster selected", variant: "destructive" });
      return;
    }

    const activeEntries = Object.values(entries).filter((e) => e.offered || e.worked);
    if (activeEntries.length === 0) {
      toast({ title: "Validation Error", description: "At least one employee must be offered or worked.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Validation Error", description: "Description is required.", variant: "destructive" });
      return;
    }
    if (!dayType) {
      toast({ title: "Validation Error", description: "Day type is required.", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      data: {
        rosterId: activeRosterId,
        date: dateStr,
        description,
        defaultHours: parseFloat(defaultHours) || 0,
        dayType,
        multiplier: parseFloat(multiplier) || 1,
        entries: activeEntries.map((e) => ({
          employeeId: e.employeeId,
          offered: e.offered,
          worked: e.worked,
          hoursOverride: e.hoursOverride ? parseFloat(e.hoursOverride) : null,
        })),
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Log Overtime Event</h1>
        <p className="text-muted-foreground mt-1">Record a new shift or overtime occurrence.</p>
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
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal bg-background", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={handleDateChange} initialFocus />
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
              <Label htmlFor="hours">Hours</Label>
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
              {suggestion && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Suggested: {suggestion.reason}
                </p>
              )}
              <Select
                value={dayType}
                onValueChange={(v: string) => {
                  setDayType(v);
                  setDayTypeOverridden(true);
                }}
              >
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
          <CardDescription>Select who was offered and who actually worked.</CardDescription>
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
                      {activeRosterId ? "No active employees in this roster." : "Select a roster first."}
                    </td>
                  </tr>
                ) : (
                  activeEmployees.map((emp) => {
                    const entry = entries[emp.id] || { offered: false, worked: false, hoursOverride: "" };
                    return (
                      <tr
                        key={emp.id}
                        className={cn(
                          "hover:bg-muted/10 transition-colors",
                          (entry.offered || entry.worked) && "bg-primary/5 hover:bg-primary/10"
                        )}
                      >
                        <td className="px-6 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-mono text-xs w-6 inline-block">
                              #{emp.seniority}
                            </span>
                            <div>
                              <div>{emp.name}</div>
                              {emp.subclassName && (
                                <div className="text-xs text-muted-foreground">{emp.subclassName}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Checkbox
                            checked={entry.offered}
                            onCheckedChange={(c) => handleEntryChange(emp.id, "offered", !!c)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Checkbox
                            checked={entry.worked}
                            onCheckedChange={(c) => handleEntryChange(emp.id, "worked", !!c)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
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

      <div className="flex justify-end pt-4 pb-12">
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto px-8 gap-2 font-bold"
          disabled={createMutation.isPending || isLoading || !activeRosterId}
        >
          <Save className="w-5 h-5" />
          {createMutation.isPending ? "Saving..." : "Submit Event"}
        </Button>
      </div>
    </form>
  );
}
