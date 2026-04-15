import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getBusinessYmd } from "../../utils/businessTime";
import { useAuth } from "../../contexts/AuthContext";
import PaymentDrawer from "../../components/finance/payments/PaymentDrawer";
import PaymentsFilters from "../../components/finance/payments/PaymentsFilters";
import PaymentsSummaryCards from "../../components/finance/payments/PaymentsSummaryCards";
import PaymentsTable from "../../components/finance/payments/PaymentsTable";
import ReversePaymentModal from "../../components/finance/payments/ReversePaymentModal";
import type {
  BranchOption,
  PaymentRow,
  PaymentsFilterState,
  PaymentsListResponse,
} from "../../components/finance/payments/types";

const PAGE_TITLE = "Төлбөрүүд";

function todayDate() {
  return getBusinessYmd();
}

function monthStartDate() {
  const ymd = getBusinessYmd();
  return `${ymd.slice(0, 7)}-01`;
}

const DEFAULT_FILTERS: PaymentsFilterState = {
  from: monthStartDate(),
  to: todayDate(),
  branchId: "",
  method: "",
  status: "all",
  patientSearch: "",
  invoiceId: "",
  createdBy: "",
  page: 1,
  pageSize: 20,
};

export default function FinancePaymentsPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [filters, setFilters] = useState<PaymentsFilterState>(DEFAULT_FILTERS);
  const [patientInput, setPatientInput] = useState("");
  const [data, setData] = useState<PaymentsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerPaymentId, setDrawerPaymentId] = useState<number | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [reverseTarget, setReverseTarget] = useState<PaymentRow | null>(null);
  const [reverseSubmitting, setReverseSubmitting] = useState(false);
  const [reverseError, setReverseError] = useState("");

  const canView =
    me?.role === "admin" || me?.role === "manager" || me?.role === "accountant" || me?.role === "super_admin";
  const canReverse = me?.role === "admin" || me?.role === "super_admin";
  const canReversePayment = (row: PaymentRow | null) => {
    if (!row || !canReverse) return false;
    if (row.status !== "active") return false;
    return String(row.invoice?.statusLegacy || "").toLowerCase() !== "voided";
  };

  useEffect(() => {
    if (!authLoading && me && !canView) {
      void router.replace("/");
    }
  }, [authLoading, me, canView, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, patientSearch: patientInput.trim(), page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [patientInput]);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then((json) => setBranches(Array.isArray(json) ? json : []))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (authLoading || !me || !canView) return;
    if (!filters.from || !filters.to) return;

    const params = new URLSearchParams({
      from: filters.from,
      to: filters.to,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      status: filters.status,
    });
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.method) params.set("method", filters.method);
    if (filters.patientSearch) params.set("patientSearch", filters.patientSearch);
    if (filters.invoiceId) params.set("invoiceId", filters.invoiceId);
    if (filters.createdBy) params.set("createdBy", filters.createdBy);

    setLoading(true);
    setError("");

    fetch(`/api/payments?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Төлбөр татахад алдаа гарлаа.");
        return json as PaymentsListResponse;
      })
      .then((json) => setData(json))
      .catch((err: any) => {
        setError(err?.message || "Төлбөр татахад алдаа гарлаа.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [authLoading, me, canView, filters, refreshSignal]);

  const summary = useMemo(
    () =>
      data?.summary || {
        totalPayments: 0,
        activeTotal: 0,
        reversedTotal: 0,
        netCollected: 0,
      },
    [data]
  );

  const submitReverse = async (reason: string) => {
    if (!canReversePayment(reverseTarget)) return;
    if (!reverseTarget) return;
    setReverseSubmitting(true);
    setReverseError("");
    try {
      const res = await fetch(`/api/payments/${reverseTarget.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Төлбөр буцаахад алдаа гарлаа.");
      }
      setReverseTarget(null);
      setRefreshSignal((prev) => prev + 1);
    } catch (err: any) {
      setReverseError(err?.message || "Төлбөр буцаахад алдаа гарлаа.");
    } finally {
      setReverseSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-500">Ачаалж байна...</div>;
  }

  return (
    <div className="p-6 font-sans">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{PAGE_TITLE}</h1>
      </div>

      <PaymentsFilters
        filters={filters}
        branches={branches}
        patientInput={patientInput}
        onPatientInputChange={setPatientInput}
        onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={() => {
          setFilters(DEFAULT_FILTERS);
          setPatientInput("");
        }}
      />

      <PaymentsSummaryCards summary={summary} />

      <PaymentsTable
        rows={data?.items || []}
        loading={loading}
        error={error}
        page={filters.page}
        pageSize={filters.pageSize}
        total={data?.total || 0}
        canReverse={canReverse}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        onOpen={setDrawerPaymentId}
        onReverse={(paymentId) => {
          const row = (data?.items || []).find((item) => item.id === paymentId) || null;
          if (!canReversePayment(row)) return;
          setReverseError("");
          setReverseTarget(row);
        }}
      />

      <PaymentDrawer
        open={!!drawerPaymentId}
        paymentId={drawerPaymentId}
        canReverse={canReverse}
        refreshSignal={refreshSignal}
        onClose={() => setDrawerPaymentId(null)}
        onDataChanged={() => setRefreshSignal((prev) => prev + 1)}
      />

      <ReversePaymentModal
        open={!!reverseTarget}
        submitting={reverseSubmitting}
        error={reverseError}
        onClose={() => setReverseTarget(null)}
        onConfirm={submitReverse}
      />
    </div>
  );
}
