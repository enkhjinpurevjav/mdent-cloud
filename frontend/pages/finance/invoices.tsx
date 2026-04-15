import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../contexts/AuthContext";
import { getBusinessYmd } from "../../utils/businessTime";
import InvoiceDrawer from "../../components/finance/invoices/InvoiceDrawer";
import InvoiceFilters from "../../components/finance/invoices/InvoiceFilters";
import InvoiceSummaryCards from "../../components/finance/invoices/InvoiceSummaryCards";
import InvoiceTable from "../../components/finance/invoices/InvoiceTable";
import type {
  BranchOption,
  DoctorOption,
  InvoiceFilterState,
  InvoiceListResponse,
} from "../../components/finance/invoices/types";

const PAGE_TITLE = "Нэхэмжлэлүүд";

function todayDate() {
  return getBusinessYmd();
}

function monthStartDate() {
  const ymd = getBusinessYmd();
  return `${ymd.slice(0, 7)}-01`;
}

const DEFAULT_FILTERS: InvoiceFilterState = {
  from: monthStartDate(),
  to: todayDate(),
  branchId: "",
  doctorId: "",
  paymentStatus: "all",
  ebarimtStatus: "all",
  patientSearch: "",
  invoiceId: "",
  page: 1,
  pageSize: 20,
};

export default function FinanceInvoicesPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [filters, setFilters] = useState<InvoiceFilterState>(DEFAULT_FILTERS);
  const [patientInput, setPatientInput] = useState("");
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const canView = me?.role === "admin" || me?.role === "manager" || me?.role === "accountant" || me?.role === "super_admin";

  useEffect(() => {
    if (!authLoading && me && !canView) {
      void router.replace("/");
    }
  }, [authLoading, me, router]);

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

    fetch("/api/users?role=doctor")
      .then((res) => res.json())
      .then((json) => setDoctors(Array.isArray(json) ? json : []))
      .catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (authLoading || !me || !canView) return;
    if (!filters.from || !filters.to) return;

    const params = new URLSearchParams({
      from: filters.from,
      to: filters.to,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      paymentStatus: filters.paymentStatus,
      ebarimtStatus: filters.ebarimtStatus,
    });
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.doctorId) params.set("doctorId", filters.doctorId);
    if (filters.patientSearch) params.set("patientSearch", filters.patientSearch);
    if (filters.invoiceId) params.set("invoiceId", filters.invoiceId);

    setLoading(true);
    setError("");
    fetch(`/api/invoices?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Нэхэмжлэл татахад алдаа гарлаа.");
        return json as InvoiceListResponse;
      })
      .then((json) => setData(json))
      .catch((err: any) => {
        setError(err?.message || "Нэхэмжлэл татахад алдаа гарлаа.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [authLoading, me, canView, filters, refreshSignal]);

  const summary = useMemo(
    () =>
      data?.summary || {
        totalBilled: 0,
        totalCollected: 0,
        totalUnpaid: 0,
        overpayments: 0,
      },
    [data]
  );

  if (authLoading) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-500">Ачаалж байна...</div>;
  }

  return (
    <div className="p-6 font-sans">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{PAGE_TITLE}</h1>
      </div>

      <InvoiceFilters
        filters={filters}
        branches={branches}
        doctors={doctors}
        patientInput={patientInput}
        onPatientInputChange={setPatientInput}
        onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={() => {
          setFilters(DEFAULT_FILTERS);
          setPatientInput("");
        }}
      />

      <InvoiceSummaryCards summary={summary} />

      <InvoiceTable
        rows={data?.items || []}
        loading={loading}
        error={error}
        page={filters.page}
        pageSize={filters.pageSize}
        total={data?.total || 0}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        onOpen={setDrawerInvoiceId}
      />

      <InvoiceDrawer
        open={!!drawerInvoiceId}
        invoiceId={drawerInvoiceId}
        onClose={() => setDrawerInvoiceId(null)}
        onDataChanged={() => setRefreshSignal((prev) => prev + 1)}
        refreshSignal={refreshSignal}
      />
    </div>
  );
}
