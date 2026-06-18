import React, { useState, useEffect, useMemo } from "react";
import {
  useGetUpNext,
  getGetUpNextQueryKey,
  useGetStats,
  getGetStatsQueryKey,
  useListDayTypeConfig,
  getListDayTypeConfigQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Clock, Users } from "lucide-react";
import { Link } from "wouter";
import { useRoster } from "@/hooks/use-roster";
import { cn } from "@/lib/utils";

export default function Home() {
  const { activeRosterId, activeRoster } = useRoster();
  const [dayType, setDayType] = useState<string>("");

  const { data: dayTypeConfigs } = useListDayTypeConfig(activeRosterId ?? 0, {
    query: {
      queryKey: getListDayTypeConfigQueryKey(activeRosterId ?? 0),
      enabled: activeRosterId != null,
    },
  });

  const enabledDayTypes = useMemo(() => {
    if (!dayTypeConfigs || dayTypeConfigs.length === 0) return [];
    return dayTypeConfigs.filter((c) => c.enabled);
  }, [dayTypeConfigs]);

  useEffect(() => {
    if (enabledDayTypes.length === 0) return;
    if (!enabledDayTypes.find((c) => c.dayType === dayType)) {
      setDayType(enabledDayTypes[0].dayType);
    }
  }, [enabledDayTypes]);

  const { data: upNextData, isLoading: isLoadingUpNext } = useGetUpNext(
    { rosterId: activeRosterId ?? 0, dayType },
    {
      query: {
        queryKey: getGetUpNextQueryKey({ rosterId: activeRosterId ?? 0, dayType }),
        enabled: activeRosterId != null,
      },
    }
  );

  const { data: stats, isLoading: isLoadingStats } = useGetStats(
    { rosterId: activeRosterId ?? undefined },
    {
      query: {
        queryKey: getGetStatsQueryKey({ rosterId: activeRosterId ?? undefined }),
        enabled: activeRosterId != null,
      },
    }
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">
            {activeRoster ? (
              <>Rotation for <span className="font-medium text-foreground">{activeRoster.name}</span></>
            ) : (
              "Current overtime rotation and statistics."
            )}
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Log Overtime Event
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Offered</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold">{stats?.totalOfferedHours || 0}h</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Worked</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold">{stats?.totalWorkedHours || 0}h</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold">{stats?.employeeCount || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl">Up Next Rotation</CardTitle>
              <CardDescription className="mt-1">
                Ordered by subclass priority → fairness hours → seniority.
              </CardDescription>
            </div>
            {enabledDayTypes.length > 1 && (
              <div className="flex p-1 bg-secondary rounded-md shadow-inner">
                {enabledDayTypes.map((cfg) => (
                  <button
                    key={cfg.dayType}
                    data-testid={`btn-${cfg.dayType}`}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                      dayType === cfg.dayType
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setDayType(cfg.dayType)}
                  >
                    {cfg.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <div className="p-0">
          {!activeRosterId ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>No roster selected. Choose one from the sidebar.</p>
            </div>
          ) : isLoadingUpNext ? (
            <div className="space-y-4 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !upNextData?.employees?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>No active employees found in this roster.</p>
            </div>
          ) : (
            <div className="divide-y">
              {upNextData.employees.map((emp, index) => (
                <div
                  key={emp.id}
                  className={cn(
                    "flex items-center justify-between p-4 sm:px-6 hover:bg-muted/30 transition-colors border-l-4",
                    index === 0 ? "bg-primary/5 border-l-primary" : "border-l-transparent"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold text-sm">
                      {emp.rank}
                    </div>
                    <div>
                      <div className="font-semibold text-base">{emp.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>Seniority: #{emp.seniority}</span>
                        {emp.subclassName && (
                          <>
                            <span>&bull;</span>
                            <span>{emp.subclassName}</span>
                          </>
                        )}
                        {emp.roleName && (
                          <>
                            <span>&bull;</span>
                            <span className="italic">{emp.roleName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">{emp.totalOfferedHours}h</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Offered</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
