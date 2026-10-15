import { useEffect, useState } from "react";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { apiErrorMessage } from "../../shared/api/client";
import type { LedgerEntry, Reconciliation } from "../../shared/types/kitchenAccounting";
import { businessDateValue } from "../accounting/accountingLogic";

export function revenueDates(today = businessDateValue()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00+07:00`);
    date.setDate(date.getDate() - 6 + index);
    return businessDateValue(date);
  });
}

export function useManagementFinance() {
  const [daily, setDaily] = useState<Reconciliation | null>(null);
  const [monthly, setMonthly] = useState<Reconciliation | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const today = businessDateValue();
  const dates = revenueDates(today);
  useEffect(() => {
    let active = true;
    async function loadLedger() {
      const entries: LedgerEntry[] = [];
      for (let page = 0; ; page++) {
        const result = await kitchenAccountingApi.ledger({ entry_type: "REVENUE_RECOGNIZED", from: dates[0], to: today, page, size: 100 });
        entries.push(...result.items);
        if (!active || page + 1 >= result.totalPages) return entries;
      }
    }
    Promise.all([
      kitchenAccountingApi.reconciliation({ from: today, to: today }),
      kitchenAccountingApi.reconciliation({ from: `${today.slice(0, 7)}-01`, to: today }),
      loadLedger(),
    ]).then(([day, month, entries]) => {
      if (active) { setDaily(day); setMonthly(month); setLedger(entries); setError(null); }
    }).catch(cause => {
      if (active) { setDaily(null); setMonthly(null); setLedger([]); setError(apiErrorMessage(cause, "Không thể tải số liệu tài chính.")); }
    });
    return () => { active = false; };
  }, [today, version]);
  const days = dates.map(date => ({
    date, day: `${date.slice(8, 10)}/${date.slice(5, 7)}`, today: date === today,
    rev: ledger.filter(row => row.finalized && row.occurred_at.slice(0, 10) === date)
      .reduce((sum, row) => sum + (row.direction === "CREDIT" ? row.amount : -row.amount), 0),
  }));
  return { daily, monthly, days, today, error, reload: () => setVersion(value => value + 1) };
}

export type ManagementFinance = ReturnType<typeof useManagementFinance>;
