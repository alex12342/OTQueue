import React, { useState } from "react";
import { useLocation } from "wouter";
import { 
  useListEmployees, 
  getListEmployeesQueryKey,
  useCreateEvent,
  getGetUpNextQueryKey,
  getListEventsQueryKey,
  getGetStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState("");
  const [defaultHours, setDefaultHours] = useState("4");
  const [dayType, setDayType] = useState<"weekday" | "weekend">("weekday");
  
  const [entries, setEntries] = useState<Record<number, EntryState>>({});

  const { data: employees, isLoading } = useListEmployees({
    query: { queryKey: getListEmployeesQueryKey() }
  });

  const activeEmployees = React.useMemo(() => {
    return (employees || []).filter(e => e.active).sort((a, b) => a.seniority - b.seniority);
  }, [employees]);

  // Update dayType automatically if date falls on weekend
  React.useEffect(() => {
    if (date) {
      const day = date.getDay();
      setDayType(day === 0 || day === 6 ? "weekend" : "weekday");
    }
  }, [date]);

  const createMutation = useCreateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Success", description: "Overtime event logged successfully." });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ dayType: "weekday" }) });
        queryClient.invalidateQueries({ queryKey: getGetUpNextQueryKey({ dayType: "weekend" }) });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        setLocation("/log");
      },
      onError: (err) => {
        toast({ title: "Error", description: "Failed to log event. Check form data.", variant: "destructive" });
      }
    }
  });

  const handleEntryChange = (empId: number, field: keyof EntryState, value: any) => {
    setEntries(prev => {
      const current = prev[empId] || { employeeId: empId, offered: false, worked: false, hoursOverride: "" };
      const next = { ...current, [field]: value };
      
      // Rule: "Worked" implies "Offered"
      if (field === "worked" && value === true) {
        next.offered = true;
      }
      
      return { ...prev, [empId]: next };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const activeEntries = Object.values(entries).filter(e => e.offered || e.worked);
    
    if (activeEntries.length === 0) {
      toast({ title: "Validation Error", description: "At least one employee must be checked as offered or worked.", variant: "destructive" });
      return;
    }

    if (!description.trim()) {
      toast({ title: "Validation Error", description: "Description is required.", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      data: {
        date: format(date, "yyyy-MM-dd"),
        description,
        defaultHours: parseFloat(defaultHours) || 0,
        dayType,
        entries: activeEntries.map(e => ({
          employeeId: e.employeeId,
          offered: e.offered,
          worked: e.worked,
          hoursOverride: e.hoursOverride ? parseFloat(e.hoursOverride) : null
        }))
      }
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
                    className={cn(
                      "w-full justify-start text-left font-normal bg-background",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input 
                id="description" 
                placeholder="e.g. Line 4 Cleanup, Sick Coverage" 
                value={description}
                onChange={e => setDescription(e.target.value)}
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
                onChange={e => setDefaultHours(e.target.value)}
                className="bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Day Type</Label>
              <Select value={dayType} onValueChange={(v: "weekday"|"weekend") => setDayType(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekday">Weekday</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Roster Assignments</CardTitle>
            <CardDescription>Select who was offered and who actually worked.</CardDescription>
          </div>
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
                  activeEmployees.map(emp => {
                    const entry = entries[emp.id] || { offered: false, worked: false, hoursOverride: "" };
                    return (
                      <tr key={emp.id} className={cn("hover:bg-muted/10 transition-colors", (entry.offered || entry.worked) && "bg-primary/5 hover:bg-primary/10")}>
                        <td className="px-6 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-mono text-xs w-6 inline-block">#{emp.seniority}</span>
                            {emp.name}
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
          disabled={createMutation.isPending || isLoading}
        >
          <Save className="w-5 h-5" />
          {createMutation.isPending ? "Saving..." : "Submit Event"}
        </Button>
      </div>
    </form>
  );
}
