import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getBusinessYmd } from "../../utils/businessTime";
import { useAuth } from "../../contexts/AuthContext";
import EncounterFinanceDrawer from "../../components/finance/encounters/EncounterFinanceDrawer";
import EncounterFinanceFilters from "../../components/finance/encounters/EncounterFinanceFilters";
import EncounterFinanceSummaryCards from "../../components/finance/encounters/EncounterFinanceSummaryCards";
import EncounterFinanceTable from "../../components/finance/encounters/EncounterFinanceTable";
import type {
  BranchOption,
  DoctorOption,
  EncounterBillingStatus,
  EncounterFinanceFilterState,
  EncounterFinanceListResponse,
  ServiceCategoryOption,
} from "../../components/finance/encounters/types";

const PAGE_TITLE = "Үзлэгүүд";

function todayDate() {
  return getBusinessYmd();
}

function monthStartDate() {
  const ymd = getBusinessYmd();
  return `${ymd.slice(0, 7)}-01`;
}

const DEFAULT_FILTERS: EncounterFinanceFilterState = {
  from: monthStartDate(),
  to: todayDate(),
  branchId: "",
  doctorId: "",
  encounterStatus: "",
  billingStatus: "all",
  patient: "",
  encounterId: "",
  serviceCategoryIds: [],
  page: 1,
  pageSize: 20,
};

export default function FinanceEncountersPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryOption[]>([]);
  const [filters, setFilters] = useState<EncounterFinanceFilterState>(DEFAULT_FILTERS);
  const [patientInput, setPatientInput] = useState("");
  const [data, setData] = useState<EncounterFinanceListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerEncounterId, setDrawerEncounterId] = useState<number | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const canView =
    me?.role === "admin" ||
    me?.role === "manager" ||
    me?.role === "accountant" ||
    me?.role === "super_admin" ||
    me?.role === "receptionist";

  useEffect(() => {
    if (!authLoading && me && !canView) {
      void router.replace("/");
    }
  }, [authLoading, me, canView, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, patient: patientInput.trim(), page: 1 }));
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

    fetch("/api/service-category-settings")
      .then((res) => res.json())
      .then((json) => setServiceCategories(Array.isArray(json) ? json : []))
      .catch(() => setServiceCategories([]));
  }, []);

  useEffect(() => {
    if (authLoading || !me || !canView) return;
    if (!filters.from || !filters.to) return;

    const params = new URLSearchParams({
      from: filters.from,
      to: filters.to,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      billingStatus: filters.billingStatus,
    });
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.doctorId) params.set("doctorId", filters.doctorId);
    if (filters.encounterStatus) params.set("encounterStatus", filters.encounterStatus);
    if (filters.patient) params.set("patient", filters.patient);
    if (filters.encounterId) params.set("encounterId", filters.encounterId);
    if (filters.serviceCategoryIds.length > 0) {
      params.set("serviceCategoryIds", filters.serviceCategoryIds.join(","));
    }

    setLoading(true);
    setError("");
    fetch(`/api/finance/encounters?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Үзлэг татахад алдаа гарлаа.");
        return json as EncounterFinanceListResponse;
      })
      .then((json) => setData(json))
      .catch((err: any) => {
        setError(err?.message || "Үзлэг татахад алдаа гарлаа.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [authLoading, me, canView, filters, refreshSignal]);

  const summary = useMemo(
    () =>
      data?.summary || {
        totalEncounters: 0,
        noInvoice: 0,
        invoicedUnpaidOrPartial: 0,
        freeEncounters: 0,
        closedWithoutPayment: 0,
      },
    [data]
  );

  const billingStatusOptions = useMemo(
    () => data?.billingStatusOptions || (["no_invoice", "unpaid", "partial", "paid", "free", "close_without_payment"] as Array<Exclude<EncounterBillingStatus, "all">>),
    [data]
  );

  const encounterStatusOptions = useMemo(() => data?.encounterStatusOptions || [], [data]);

  if (authLoading) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-500">Ачаалж байна...</div>;
  }

  return (
    <div className="p-6 font-sans">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{PAGE_TITLE}</h1>
      </div>

      <EncounterFinanceFilters
        filters={filters}
        branches={branches}
        doctors={doctors}
        serviceCategories={serviceCategories}
        billingStatusOptions={billingStatusOptions}
        encounterStatusOptions={encounterStatusOptions}
        patientInput={patientInput}
        onPatientInputChange={setPatientInput}
        onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={() => {
          setFilters(DEFAULT_FILTERS);
          setPatientInput("");
        }}
      />

      <EncounterFinanceSummaryCards summary={summary} />

      <EncounterFinanceTable
        rows={data?.items || []}
        loading={loading}
        error={error}
        page={filters.page}
        pageSize={filters.pageSize}
        total={data?.total || 0}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        onOpen={setDrawerEncounterId}
      />

      <EncounterFinanceDrawer
        encounterId={drawerEncounterId}
        open={!!drawerEncounterId}
        refreshSignal={refreshSignal}
        onClose={() => setDrawerEncounterId(null)}
        onDataChanged={() => setRefreshSignal((prev) => prev + 1)}
      />
    </div>
  );
}
