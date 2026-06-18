import React from "react";
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
import { Calendar as CalendarIcon, Clock, Users, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function EventLog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: events, isLoading } = useListEvents({
    query: { queryKey: getListEventsQueryKey() }
  });

  const deleteMutation = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event deleted", description: "The overtime event has been removed." });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
      onError: (error) => {
        toast({ title: "Error", description: "Failed to delete event", variant: "destructive" });
      }
    }
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overtime Log</h1>
        <p className="text-muted-foreground mt-1">History of all recorded overtime events.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !events?.length ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No events recorded</h3>
          <p className="text-muted-foreground mt-2">Log your first overtime event to see it here.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle className="text-lg">{event.description}</CardTitle>
                    <Badge variant={event.dayType === 'weekend' ? "secondary" : "outline"} className="capitalize">
                      {event.dayType}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" /> {format(new Date(event.date), "MMM d, yyyy")}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {event.defaultHours}h Default</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {event.entries?.length || 0} Involved</span>
                  </CardDescription>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
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
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none border-0">Worked</Badge>
                            ) : entry.offered ? (
                              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Offered</Badge>
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
                        <tr><td colSpan={3} className="px-6 py-4 text-center text-muted-foreground">No entries recorded</td></tr>
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
