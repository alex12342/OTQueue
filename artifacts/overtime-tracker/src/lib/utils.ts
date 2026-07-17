import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge className values with tailwind-merge to avoid conflicts
 */
import { QueryClient } from "@tanstack/react-query";
import { getGetEventQueryKey } from "@workspace/api-client-react";

export function invalidateEventQueries(queryClient: QueryClient, rosterId: number | null) {
  if (!rosterId) return;
  queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(rosterId) });
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
