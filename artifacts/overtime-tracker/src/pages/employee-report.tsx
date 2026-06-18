import React from "react";
import { useParams, Link } from "wouter";
import { useGetEmployeeReport, getGetEmployeeReportQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, History, BarChart, CheckCircle2 } from "lucide-react";

export default function EmployeeReport() {
  const { id } = useParams<{ id: string }>();
  
  const { data: report, isLoading, error } = useGetEmployeeReport(parseInt(id, 10), {
    query: { 
      queryKey: getGetEmployeeReportQueryKey(parseInt(id, 10)),
      enabled: !!id 
    }
  });

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive">Error Loading Report</h2>
        <p className="text-muted-foreground mt-2">Could not find employee details.</p>
        <Link href="/employees" className="text-primary hover:underline mt-4 inline-block">Return to Roster</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/employees" className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isLoading ? <Skeleton className="h-8 w-48" /> : report?.employee.name}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
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
                <span>{report?.employee.category === 'full_time' ? 'Full Time' : '4-Hour'}</span>
              </>
            )}
          </p>
        </div>
      </div>

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
                {report?.acceptanceRate != null ? `${report.acceptanceRate.toFixed(1)}%` : '-'}
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
                      <td className="px-6 py-4 font-medium text-foreground">
                        {evt.description}
                      </td>
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
