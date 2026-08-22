import { useEffect, useRef } from "react";
import { AUTH_EXPIRED_EVENT, handleAuthExpired } from "@/lib/auth";

/**
 * Subscribes to the global `otqueue:auth-expired` CustomEvent and calls
 * `handleAuthExpired()` when fired.  This is the glue between the 401
 * interceptor in customFetch and the redirect-to-login flow.
 *
 * Usage — drop it inside `<App>` (or any component rendered when authenticated):
 *
 *   function App() {
 *     useAuthExpired();
 *     return <Routes>…</Routes>;
 *   }
 */
export function useAuthExpired() {
  const handled = useRef(false);

  useEffect(() => {
    const onAuthExpired = () => {
      // Guard against double-fire (some browsers dispatch the same event
      // to multiple listeners in rapid succession).
      if (handled.current) return;
      handled.current = true;
      handleAuthExpired();
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    };
  }, []);
}

export default useAuthExpired;
