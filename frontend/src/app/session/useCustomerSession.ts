import { useEffect, useState } from "react";
import { authApi } from "../../shared/api/auth";
import { apiClient } from "../../shared/api/client";

export function useCustomerSession(): [boolean, (authenticated: boolean) => void] {
  const [authenticated, setAuthenticated] = useState(() => {
    const token = apiClient.store.get()?.access_token;
    const identity = apiClient.store.getIdentity?.();
    return Boolean(token && identity === "customer");
  });

  useEffect(() => {
    const token = apiClient.store.get()?.access_token;
    const identity = apiClient.store.getIdentity?.();
    if (!token || identity !== "customer") return;

    let active = true;
    authApi.customerProfile()
      .then(() => {
        if (active) setAuthenticated(true);
      })
      .catch(() => {
        if (!active) return;
        setAuthenticated(false);
        apiClient.store.clear();
      });

    return () => { active = false; };
  }, []);

  return [authenticated, setAuthenticated];
}
