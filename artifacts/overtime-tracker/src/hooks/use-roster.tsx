import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useListRosters, getListRostersQueryKey } from "@workspace/api-client-react";
import type { Roster } from "@workspace/api-client-react";

const STORAGE_KEY = "otqueue_active_roster_id";

interface RosterContextValue {
  rosters: Roster[];
  activeRosterId: number | null;
  activeRoster: Roster | null;
  setActiveRosterId: (id: number) => void;
  isLoading: boolean;
}

const RosterContext = createContext<RosterContextValue | null>(null);

export function RosterProvider({ children }: { children: React.ReactNode }) {
  console.log('[RosterProvider] mount');
  const [activeRosterId, setActiveRosterIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const { data: rosters = [], isLoading } = useListRosters({
    query: { queryKey: getListRostersQueryKey() },
  });

  useEffect(() => {
    if (!isLoading && rosters.length > 0) {
      const stored = localStorage.getItem(STORAGE_KEY);
      const storedId = stored ? parseInt(stored, 10) : null;
      const valid = storedId && rosters.some((r) => r.id === storedId);
      if (!valid) {
        const first = rosters[0].id;
        setActiveRosterIdState(first);
        localStorage.setItem(STORAGE_KEY, String(first));
      }
    }
  }, [rosters, isLoading]);

  const setActiveRosterId = useCallback((id: number) => {
    setActiveRosterIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const activeRoster = rosters.find((r) => r.id === activeRosterId) ?? null;

  return (
    <RosterContext.Provider value={{ rosters, activeRosterId, activeRoster, setActiveRosterId, isLoading }}>
      {children}
    </RosterContext.Provider>
  );
}

export function useRoster() {
  const ctx = useContext(RosterContext);
  if (!ctx) throw new Error("useRoster must be used inside RosterProvider");
  return ctx;
}
