import React, { useState, useMemo } from "react";
import { useListEvents, useDeleteEvent, getListEventsQueryKey, getGetStatsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, Clock, Users, Trash2, Pencil, Search, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
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
import { useToast } from "@/hooks/use-toast";

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

export default function EventLog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: events, isLoading } = useListEvents({
    query: { queryKey: getListEventsQueryKey() },
  });

  const deleteMutation = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event deleted", description: "The overtime event has been removed." });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete event", variant: "destructive" });
      },
    },
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => {
      if (ev.description.toLowerCase().includes(q)) return true;
      if (ev.date.includes(q)) return true;
      try {
        if (format(new Date(ev.date), "MMM d, yyyy").toLowerCase().includes(q)) return true;
      } catch {}
      if (ev.dayType?.toLowerCase().includes(q)) return true;
      if (ev.entries?.some((e) => e.employeeName.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [events, search]);

  const handleExport = () => {
    if (!filteredEvents.length) return;
    const header = ["Event ID", "Date", "Description", "Day Type", "Default Hours", "Employee", "Status", "Hours Override", "Hours Offered", "Hours Awarded"];
    const rows: string[][] = [header];
    for (const ev of filteredEvents) {
      if (!ev.entries?.length) {
        rows.push([String(ev.id), ev.date, ev.description, ev.dayType ?? "", String(ev.defaultHours), "", "", "", "", ""]);
      } else {
        for (const entry of ev.entries) {
          const status = entry.worked ? "Worked" : entry.offered ? "Offered" : "";
          rows.push([
            String(ev.id),
            ev.date,
            ev.description,
            ev.dayType ?? "",
            String(ev.defaultHours),
            entry.employeeName,
            status,
            entry.hoursOverride != null ? String(entry.hoursOverride) : "",
            String(entry.hoursOffered),
            String(entry.hoursAwarded),
          ]);
        }
      }
    }
    const label = search.trim() ? "filtered" : "all";
    downloadCsv(`otqueue-event-log-${label}-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
    toast({ title: "Export ready", description: `${filteredEvents.length} event(s) exported.` });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overtime Log</h1>
          <p className="text-muted-foreground mt-1">History of all recorded overtime events.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0 mt-1"
          onClick={handleExport}
          disabled={isLoading || !filteredEvents.length}
          data-testid="button-export-events"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by description, date, employee name, or day type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 bg-background"
          data-testid="input-search-events"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {search && !isLoading && (
        <p className="text-sm text-muted-foreground -mt-2">
          {filteredEvents.length === 0
            ? "No events match your search."
            : `${filteredEvents.length} of ${events?.length ?? 0} event${filteredEvents.length !== 1 ? "s" : ""} match`}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !filteredEvents.length ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">
            {search ? "No matching events" : "No events recorded"}
          </h3>
          <p className="text-muted-foreground mt-2">
            {search ? "Try a different search term." : "Log your first overtime event to see it here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle className="text-lg">{event.description}</CardTitle>
                    <Badge variant={event.dayType === "weekend" ? "secondary" : "outline"} className="capitalize">
                      {event.dayType}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5" /> {format(new Date(event.date), "MMM d, yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {event.defaultHours}h Default
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {event.entries?.length || 0} Involved
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/events/${event.id}/edit`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      data-testid={`button-edit-event-${event.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the event and reverse its hours from the employees' totals. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: event.id })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                      <tr>
                        <th className="px-6 py-3 font-medium">Employee</th>
                        <th className="px-6 py-3 font-medium text-center">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Hours Awarded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {event.entries?.map((entry) => (
                        <tr key={entry.id} className="hover:bg-muted/10">
                          <td className="px-6 py-3 font-medium text-foreground">{entry.employeeName}</td>
                          <td className="px-6 py-3 text-center">
                            {entry.worked ? (
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none border-0">
                                Worked
                              </Badge>
                            ) : entry.offered ? (
                              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                                Offered
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums">
                            {entry.hoursAwarded ? (
                              <span className="font-medium">{entry.hoursAwarded}h</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!event.entries?.length && (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 text-center text-muted-foreground">
                            No entries recorded
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
