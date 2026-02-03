import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  email: string;
  name?: string;
  ovog?: string | null;
  role: string;
  branchId?: number | null;
  regNo?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  signatureImagePath?: string | null;
  stampImagePath?: string | null;
  idPhotoPath?: string | null;
  phone?: string | null;
  branches?: Branch[];
  calendarOrder?: number | null;
};

type DoctorScheduleDay = {
  id: number;
  date: string; // "YYYY-MM-DD"
  branch: Branch;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  note?: string | null;
};

type DoctorAppointment = {
  id: number;
  patientId: number;
  branchId: number;
  doctorId: number;
  scheduledAt: string; // ISO string
  endAt: string | null; // ISO string
  status: string;
  notes: string | null;
  patientName: string | null;
  patientOvog: string | null;
  patientBookNumber: string | null;
  branchName: string | null;
};

type ShiftType = "AM" | "PM" | "WEEKEND_FULL";
type DoctorTabKey = "profile" | "schedule" | "appointments" | "test1" | "test2";

function formatDoctorShortName(doc: Doctor) {
  const name = (doc.name || "").toString().trim();
  const ovog = (doc.ovog || "").toString().trim();
  if (ovog) return `${ovog.charAt(0).toUpperCase()}.${name || doc.email}`;
  return name || doc.email;
}

function formatIsoDateOnly(iso?: string | null) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function formatMNT(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount) + " ₮";
}

function Card({
  title,
  right,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
      }}
    >
      {(title || right) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            {title && (
              <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>
                {title}
              </div>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function InfoGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
        gap: "26px 46px",
      }}
    >
      {items.map((it, idx) => (
        <div key={idx}>
          <div style={{ color: "#6b7280", fontSize: 18, fontWeight: 600 }}>
            {it.label}
          </div>
          <div style={{ color: "#111827", fontSize: 20, fontWeight: 800 }}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 16, fontWeight: 700 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ fontSize: 34, fontWeight: 900, color: "#111827" }}>
        {value}
      </div>
      {subtitle ? (
        <div style={{ color: "#6b7280", fontSize: 16 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

export default function DoctorProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBranches, setSavingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<DoctorTabKey>("profile");

  // ✅ NEW: patient-like edit toggle for the profile info card
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Put these inside DoctorProfilePage(), near other consts (before return)
const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  padding: "4px 6px",
  fontSize: 13,
  background: "white",
};

const labelStyle: React.CSSProperties = {
  color: "#6b7280",
  marginBottom: 2,
  fontSize: 13,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  fontSize: 13,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontSize: 13,
  cursor: "pointer",
};
  
  const [form, setForm] = useState({
    name: "",
    ovog: "",
    email: "",
    branchId: "",
    regNo: "",
    licenseNumber: "",
    licenseExpiryDate: "",
    phone: "",
    signatureImagePath: "",
    stampImagePath: "",
  });

  // selected multiple branches
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  // schedule state (next 31 days)
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // schedule editor form state (top form, ONLY for creating new entries)
  const [scheduleForm, setScheduleForm] = useState<{
    date: string;
    branchId: string;
    shiftType: ShiftType;
    startTime: string;
    endTime: string;
    note: string;
  }>({
    date: "",
    branchId: "",
    shiftType: "AM",
    startTime: "09:00",
    endTime: "15:00",
    note: "",
  });

  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaveError, setScheduleSaveError] = useState<string | null>(
    null
  );
  const [scheduleSaveSuccess, setScheduleSaveSuccess] = useState<string | null>(
    null
  );

  // inline editing state for table
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(
    null
  );
  const [inlineForm, setInlineForm] = useState<{
    date: string;
    branchId: string;
    startTime: string;
    endTime: string;
    note: string;
  }>({
    date: "",
    branchId: "",
    startTime: "",
    endTime: "",
    note: "",
  });

  // History (Хуваарийн түүх) state
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<DoctorScheduleDay[]>([]);

  // Sales summary state
  const [salesSummary, setSalesSummary] = useState<{
    todayTotal: number;
    monthTotal: number;
  } | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Appointments state
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [appointmentsFrom, setAppointmentsFrom] = useState<string>("");
  const [appointmentsTo, setAppointmentsTo] = useState<string>("");

  const resetFormFromDoctor = () => {
    if (!doctor) return;
    setForm({
      name: doctor.name || "",
      ovog: doctor.ovog || "",
      email: doctor.email || "",
      branchId: doctor.branchId ? String(doctor.branchId) : "",
      regNo: doctor.regNo || "",
      licenseNumber: doctor.licenseNumber || "",
      licenseExpiryDate: doctor.licenseExpiryDate
        ? doctor.licenseExpiryDate.slice(0, 10)
        : "",
      phone: doctor.phone || "",
      signatureImagePath: doctor.signatureImagePath || "",
      stampImagePath: doctor.stampImagePath || "",
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const toggleBranch = (branchId: number) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleScheduleFormChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setScheduleForm((prev) => {
      const updated = { ...prev, [name]: value };

      // If shiftType changes, update default times depending on weekday/weekend if date is known.
      if (name === "shiftType") {
        const shift = value as ShiftType;

        if (prev.date) {
          const d = new Date(prev.date);
          const day = d.getDay(); // 0=Sun, 6=Sat
          const isWeekend = day === 0 || day === 6;

          if (isWeekend) {
            if (shift === "AM") {
              updated.startTime = "10:00";
              updated.endTime = "14:00";
            } else if (shift === "PM") {
              updated.startTime = "14:00";
              updated.endTime = "19:00";
            } else if (shift === "WEEKEND_FULL") {
              updated.startTime = "10:00";
              updated.endTime = "19:00";
            }
          } else {
            if (shift === "AM") {
              updated.startTime = "09:00";
              updated.endTime = "15:00";
            } else if (shift === "PM") {
              updated.startTime = "15:00";
              updated.endTime = "21:00";
            } else if (shift === "WEEKEND_FULL") {
              updated.startTime = "09:00";
              updated.endTime = "21:00";
            }
          }
        } else {
          if (shift === "AM") {
            updated.startTime = "09:00";
            updated.endTime = "15:00";
          } else if (shift === "PM") {
            updated.startTime = "15:00";
            updated.endTime = "21:00";
          } else if (shift === "WEEKEND_FULL") {
            updated.startTime = "10:00";
            updated.endTime = "19:00";
          }
        }
      }

      return updated;
    });
  };

  // Load branches + doctor + schedule
  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // load branches
        const bRes = await fetch("/api/branches");
        const bData = await bRes.json();
        if (bRes.ok && Array.isArray(bData)) {
          setBranches(bData);
        }

        // load doctor
        const dRes = await fetch(`/api/users/${id}`);
        const dData = await dRes.json();

        if (!dRes.ok) {
          setError(dData?.error || "Эмчийн мэдээллийг ачааллаж чадсангүй");
          setLoading(false);
          return;
        }

        const doc: Doctor = dData;
        setDoctor(doc);

        setForm({
          name: doc.name || "",
          ovog: doc.ovog || "",
          email: doc.email || "",
          branchId: doc.branchId ? String(doc.branchId) : "",
          regNo: doc.regNo || "",
          licenseNumber: doc.licenseNumber || "",
          licenseExpiryDate: doc.licenseExpiryDate
            ? doc.licenseExpiryDate.slice(0, 10)
            : "",
          phone: doc.phone || "",
          signatureImagePath: doc.signatureImagePath || "",
          stampImagePath: doc.stampImagePath || "",
        });

        // initialize multi-branch selection from doctor.branches
        const initialBranchIds = (doc.branches || []).map((b) => b.id);
        setSelectedBranchIds(initialBranchIds);

        // preselect first assigned branch in schedule form
        setScheduleForm((prev) => ({
          ...prev,
          branchId: initialBranchIds[0]
            ? String(initialBranchIds[0])
            : prev.branchId,
        }));

        // ✅ start in view mode like patient page
        setIsEditingProfile(false);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Сүлжээгээ шалгана уу");
        setLoading(false);
      }
    }

    async function loadSchedule() {
      setScheduleLoading(true);
      setScheduleError(null);

      try {
        const today = new Date();
        const from = today.toISOString().slice(0, 10);
        const toDate = new Date(today);
        toDate.setDate(today.getDate() + 31);
        const to = toDate.toISOString().slice(0, 10);

        const res = await fetch(
          `/api/users/${id}/schedule?from=${from}&to=${to}`
        );
        const data = await res.json();

        if (res.ok && Array.isArray(data)) {
          setSchedule(data);
        } else {
          setScheduleError(
            data && data.error
              ? data.error
              : "Ажлын хуваарийг ачааллаж чадсангүй"
          );
        }
      } catch (err) {
        console.error(err);
        setScheduleError("Сүлжээгээ шалгана уу");
      } finally {
        setScheduleLoading(false);
      }
    }

    async function loadSalesSummary() {
      setSalesLoading(true);
      setSalesError(null);

      try {
        const res = await fetch(`/api/doctors/${id}/sales-summary`);
        const data = await res.json();

        if (res.ok) {
          setSalesSummary({
            todayTotal: data.todayTotal || 0,
            monthTotal: data.monthTotal || 0,
          });
        } else {
          setSalesError(data?.error || "Орлогын мэдээллийг ачааллаж чадсангүй");
        }
      } catch (err) {
        console.error(err);
        setSalesError("Сүлжээгээ шалгана уу");
      } finally {
        setSalesLoading(false);
      }
    }

    // Initialize appointments date range: today to today+30
    const today = new Date();
    const defaultFrom = today.toISOString().slice(0, 10);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);
    const defaultTo = thirtyDaysLater.toISOString().slice(0, 10);
    
    setAppointmentsFrom(defaultFrom);
    setAppointmentsTo(defaultTo);

    load();
    loadSchedule();
    loadSalesSummary();
  }, [id]);

  const reloadSchedule = async () => {
    if (!id) return;
    setScheduleLoading(true);
    setScheduleError(null);

    try {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const toDate = new Date(today);
      toDate.setDate(today.getDate() + 31);
      const to = toDate.toISOString().slice(0, 10);

      const res = await fetch(`/api/users/${id}/schedule?from=${from}&to=${to}`);
      const data = await res.json();

      if (res.ok && Array.isArray(data)) {
        setSchedule(data);
      } else {
        setScheduleError(
          data && data.error
            ? data.error
            : "Ажлын хуваарийг ачаалж чадсангүй"
        );
      }
    } catch (err) {
      console.error(err);
      setScheduleError("Сүлжээгээ шалгана уу");
    } finally {
      setScheduleLoading(false);
    }
  };

  const loadAppointments = async () => {
    if (!id || !appointmentsFrom || !appointmentsTo) return;

    setAppointmentsLoading(true);
    setAppointmentsError(null);

    try {
      const res = await fetch(
        `/api/doctors/${id}/appointments?from=${appointmentsFrom}&to=${appointmentsTo}`
      );
      const data = await res.json();

      if (res.ok && Array.isArray(data)) {
        setAppointments(data);
      } else {
        setAppointmentsError(
          data?.error || "Цагуудыг ачааллаж чадсангүй"
        );
      }
    } catch (err) {
      console.error(err);
      setAppointmentsError("Сүлжээгээ шалгана уу");
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Auto-load appointments when tab is active and dates are set
  useEffect(() => {
    if (activeTab === "appointments" && appointmentsFrom && appointmentsTo) {
      loadAppointments();
    }
  }, [activeTab, appointmentsFrom, appointmentsTo]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name || null,
        ovog: form.ovog || null,
        email: form.email || null,
        branchId: form.branchId ? Number(form.branchId) : null, // legacy single branch
        regNo: form.regNo || null,
        licenseNumber: form.licenseNumber || null,
        licenseExpiryDate: form.licenseExpiryDate || null, // yyyy-mm-dd
        phone: form.phone || null,
        signatureImagePath: form.signatureImagePath || null,
        stampImagePath: form.stampImagePath || null,
      };

      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Хадгалах үед алдаа гарлаа");
        setSaving(false);
        return;
      }

      setDoctor(data);

      // ✅ after save, return to view mode like patient profile
      setIsEditingProfile(false);
    } catch (err) {
      console.error(err);
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranches = async () => {
    if (!id) return;
    setSavingBranches(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${id}/branches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: selectedBranchIds }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        setError(data?.error || "Салбар хадгалах үед алдаа гарлаа");
        setSavingBranches(false);
        return;
      }

      // update doctor.branches from response if provided
      if (data && Array.isArray(data.branches)) {
        setDoctor((prev) =>
          prev ? { ...prev, branches: data.branches } : prev
        );
      }

      // also sync schedule form branch selector if needed
      if (data && Array.isArray(data.branches) && data.branches.length > 0) {
        setScheduleForm((prev) => ({
          ...prev,
          branchId: String(data.branches[0].id),
        }));
      }
    } catch (err) {
      console.error(err);
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSavingBranches(false);
    }
  };

  // Delete doctor user
  const handleDeleteUser = async () => {
    if (!id) return;

    const ok = window.confirm(
      "Та энэхүү эмчийн аккаунтыг устгахдаа итгэлтэй байна уу?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        alert((data && data.error) || "Устгах үед алдаа гарлаа");
        return;
      }

      router.push("/users/doctors");
    } catch (err) {
      console.error(err);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  // Top form: create new schedule entry
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setScheduleSaving(true);
    setScheduleSaveError(null);
    setScheduleSaveSuccess(null);

    try {
      if (!scheduleForm.date) {
        setScheduleSaveError("Огноо сонгоно уу.");
        setScheduleSaving(false);
        return;
      }
      if (!scheduleForm.branchId) {
        setScheduleSaveError("Салбар сонгоно уу.");
        setScheduleSaving(false);
        return;
      }

      const payload = {
        date: scheduleForm.date,
        branchId: Number(scheduleForm.branchId),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        note: scheduleForm.note || null,
      };

      const res = await fetch(`/api/users/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setScheduleSaveError(
          data?.error || "Ажлын хуваарь хадгалах үед алдаа гарлаа"
        );
        setScheduleSaving(false);
        return;
      }

      setScheduleSaveSuccess("Амжилттай хадгаллаа.");
      await reloadSchedule();

      setScheduleForm((prev) => ({
        ...prev,
        date: "",
        note: "",
      }));
    } catch (err) {
      console.error(err);
      setScheduleSaveError("Сүлжээгээ шалгана уу");
    } finally {
      setScheduleSaving(false);
      setTimeout(() => setScheduleSaveSuccess(null), 3000);
    }
  };

  // Inline edit helpers
  const startEditRow = (s: DoctorScheduleDay) => {
    setEditingScheduleId(s.id);
    setInlineForm({
      date: s.date,
      branchId: String(s.branch?.id ?? ""),
      startTime: s.startTime,
      endTime: s.endTime,
      note: s.note || "",
    });
    setScheduleSaveError(null);
    setScheduleSaveSuccess(null);
  };

  const cancelEditRow = () => {
    setEditingScheduleId(null);
    setInlineForm({
      date: "",
      branchId: "",
      startTime: "",
      endTime: "",
      note: "",
    });
    setScheduleSaveError(null);
  };

  const handleInlineChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setInlineForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInlineSaveSchedule = async () => {
    if (!id) return;

    setScheduleSaving(true);
    setScheduleSaveError(null);
    setScheduleSaveSuccess(null);

    try {
      if (!inlineForm.date) {
        setScheduleSaveError("Огноо сонгоно уу.");
        setScheduleSaving(false);
        return;
      }
      if (!inlineForm.branchId) {
        setScheduleSaveError("Салбар сонгоно уу.");
        setScheduleSaving(false);
        return;
      }

      const payload = {
        date: inlineForm.date,
        branchId: Number(inlineForm.branchId),
        startTime: inlineForm.startTime,
        endTime: inlineForm.endTime,
        note: inlineForm.note || null,
      };

      const res = await fetch(`/api/users/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setScheduleSaveError(
          data?.error || "Ажлын хуваарь хадгалах үед алдаа гарлаа"
        );
        setScheduleSaving(false);
        return;
      }

      setScheduleSaveSuccess("Амжилттай хадгаллаа.");
      await reloadSchedule();
      setEditingScheduleId(null);
      setInlineForm({
        date: "",
        branchId: "",
        startTime: "",
        endTime: "",
        note: "",
      });
    } catch (err) {
      console.error(err);
      setScheduleSaveError("Сүлжээгээ шалгана уу");
    } finally {
      setScheduleSaving(false);
      setTimeout(() => setScheduleSaveSuccess(null), 3000);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!id) return;

    const ok = window.confirm(
      "Та энэхүү хуваарийг устгахдаа итгэлтэй байна уу?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}/schedule/${scheduleId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setScheduleSaveError(
          (data && (data as any).error) ||
            "Хуваарь устгах үед алдаа гарлаа"
        );
        return;
      }

      setSchedule((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch (err) {
      console.error(err);
      setScheduleSaveError("Сүлжээгээ шалгана уу");
    }
  };

  const loadHistory = async () => {
    if (!id) return;
    if (!historyFrom || !historyTo) {
      setHistoryError("Эхлэх болон дуусах огноог сонгоно уу.");
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const res = await fetch(
        `/api/users/${id}/schedule?from=${historyFrom}&to=${historyTo}`
      );
      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        setHistoryError(
          (data && data.error) || "Хуваарийн түүхийг ачааллаж чадсангүй."
        );
        setHistoryItems([]);
        return;
      }

      setHistoryItems(data);
    } catch (err) {
      console.error(err);
      setHistoryError("Сүлжээгээ шалгана уу");
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const mainBranchName = useMemo(() => {
    if (!doctor?.branchId) return null;
    return branches.find((b) => b.id === doctor.branchId)?.name || null;
  }, [doctor?.branchId, branches]);

  const doctorAssignedBranches: Branch[] =
    doctor?.branches && doctor.branches.length > 0 ? doctor.branches : branches;

  const isCreatingSchedule =
    !!scheduleForm.date &&
    !!scheduleForm.branchId &&
    editingScheduleId === null;

  // placeholders for stat cards (logic later)
  const todayAppointmentsCount = 0;

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div>Ачааллаж байна...</div>
      </div>
    );
  }

  if (error && !doctor) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Эмчийн мэдээлэл</h1>
        <div style={{ color: "red", marginTop: 8 }}>{error}</div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Эмч олдсонгүй</h1>
      </div>
    );
  }

  const headerName = formatDoctorShortName(doctor);

  return (
   <main
  style={{
    maxWidth: 1100,
    margin: "40px auto",
    padding: 24,
    fontFamily: "sans-serif",
  }}
>
      <button
  type="button"
  onClick={() => router.push("/users/doctors")}
  style={{
    marginBottom: 16,
    padding: "4px 8px",
    borderRadius: 4,
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    cursor: "pointer",
    fontSize: 13,
  }}
>
  ← Буцах
</button>

     <section
  style={{
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: 16,
    alignItems: "stretch",
    marginBottom: 24,
  }}
>
        {/* LEFT SIDEBAR */}
        <div
  style={{
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "white",
  }}
>
          <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 600 }}>
  {headerName}
</div>

          <div
            style={{
              width: "100%",
              height: 190,
              borderRadius: 10,
              border: "2px dashed #9ca3af",
              background: "#f9fafb",
              color: "#6b7280",
              fontSize: 12,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            {doctor.idPhotoPath ? (
              <img
                src={doctor.idPhotoPath}
                alt="Эмчийн зураг"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>Зураг байрлах хэсэг</span>
            )}
          </div>

          <div style={{ fontSize: 13, color: "#6b7280" }}>
  <div>Утас: {doctor.phone || "-"}</div>
  <div>И-мэйл: {doctor.email || "-"}</div>
  <div>Үндсэн салбар: {mainBranchName || "-"}</div>
  <div>Лиценз: {doctor.licenseNumber || "-"}</div>
  <div>Дуусах: {formatIsoDateOnly(doctor.licenseExpiryDate) || "-"}</div>
</div>

          

         {/* Side menu */}
<div style={{ marginTop: 16 }}>
  <div
    style={{
      fontSize: 12,
      textTransform: "uppercase",
      color: "#9ca3af",
      marginBottom: 4,
    }}
  >
    Цэс
  </div>

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      fontSize: 13,
    }}
  >
    <button
      type="button"
      onClick={() => {
        setActiveTab("profile");
        setIsEditingProfile(false);
        setError(null);
      }}
      style={{
        textAlign: "left",
        padding: "6px 10px",
        borderRadius: 6,
        border: "none",
        background: activeTab === "profile" ? "#eff6ff" : "transparent",
        color: activeTab === "profile" ? "#1d4ed8" : "#6b7280",
        fontWeight: activeTab === "profile" ? 500 : 400,
        cursor: "pointer",
      }}
    >
      Профайл
    </button>

    <button
      type="button"
      onClick={() => {
        setActiveTab("schedule");
        setIsEditingProfile(false);
        setError(null);
      }}
      style={{
        textAlign: "left",
        padding: "6px 10px",
        borderRadius: 6,
        border: "none",
        background: activeTab === "schedule" ? "#eff6ff" : "transparent",
        color: activeTab === "schedule" ? "#1d4ed8" : "#6b7280",
        fontWeight: activeTab === "schedule" ? 500 : 400,
        cursor: "pointer",
      }}
    >
      Ажлын хуваарь
    </button>

    <button
      type="button"
      onClick={() => {
        setActiveTab("appointments");
        setIsEditingProfile(false);
        setError(null);
      }}
      style={{
        textAlign: "left",
        padding: "6px 10px",
        borderRadius: 6,
        border: "none",
        background: activeTab === "appointments" ? "#eff6ff" : "transparent",
        color: activeTab === "appointments" ? "#1d4ed8" : "#6b7280",
        fontWeight: activeTab === "appointments" ? 500 : 400,
        cursor: "pointer",
      }}
    >
      Цагууд
    </button>

    <button
      type="button"
      onClick={() => {
        setActiveTab("test1");
        setIsEditingProfile(false);
        setError(null);
      }}
      style={{
        textAlign: "left",
        padding: "6px 10px",
        borderRadius: 6,
        border: "none",
        background: activeTab === "test1" ? "#eff6ff" : "transparent",
        color: activeTab === "test1" ? "#1d4ed8" : "#6b7280",
        fontWeight: activeTab === "test1" ? 500 : 400,
        cursor: "pointer",
      }}
    >
      Борлуулалт
    </button>

    <button
      type="button"
      onClick={() => {
        setActiveTab("test2");
        setIsEditingProfile(false);
        setError(null);
      }}
      style={{
        textAlign: "left",
        padding: "6px 10px",
        borderRadius: 6,
        border: "none",
        background: activeTab === "test2" ? "#eff6ff" : "transparent",
        color: activeTab === "test2" ? "#1d4ed8" : "#6b7280",
        fontWeight: activeTab === "test2" ? 500 : 400,
        cursor: "pointer",
      }}
    >
      Үзлэгийн түүх
    </button>
  </div>
</div>

          <button
            type="button"
            onClick={handleDeleteUser}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fee2e2",
              color: "#b91c1c",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Ажилтныг устгах
          </button>
        </div>

        {/* RIGHT CONTENT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Top stat cards (only on profile tab) */}
          {activeTab === "profile" && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
    }}
  >
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 12,
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        Өнөөдрийн цаг захиалга
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
        {todayAppointmentsCount}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>Нийт бүртгэлтэй цаг</div>
    </div>

    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 12,
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        Өнөөдрийн орлого
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
        {salesLoading
          ? "..."
          : salesError
          ? "-"
          : salesSummary
          ? formatMNT(salesSummary.todayTotal)
          : "-"}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>Өнөөдөр төлсөн</div>
    </div>

    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 12,
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        Энэ сарын орлого
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
        {salesLoading
          ? "..."
          : salesError
          ? "-"
          : salesSummary
          ? formatMNT(salesSummary.monthTotal)
          : "-"}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>Энэ сарын нийт</div>
    </div>
  </div>
)}

          {/* PROFILE TAB */}
          {activeTab === "profile" && (
  <>
    {/* Basic information section (editable) - patient page style */}
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 16,
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 0 }}>
          Үндсэн мэдээлэл
        </h2>

        {!isEditingProfile ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsEditingProfile(true);
            }}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              cursor: "pointer",
            }}
          >
            Засах
          </button>
        ) : null}
      </div>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {!isEditingProfile ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            fontSize: 13,
          }}
        >
          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>Овог</div>
            <div>{doctor.ovog || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>Нэр</div>
            <div>{doctor.name || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>И-мэйл</div>
            <div>{doctor.email || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>Утас</div>
            <div>{doctor.phone || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>РД</div>
            <div>{doctor.regNo || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>Үндсэн салбар</div>
            <div>{mainBranchName || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>
              Лицензийн дугаар
            </div>
            <div>{doctor.licenseNumber || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>
              Лиценз дуусах хугацаа
            </div>
            <div>{formatIsoDateOnly(doctor.licenseExpiryDate) || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>
              Ажиллах салбарууд
            </div>
            <div>
              {doctorAssignedBranches?.length
                ? doctorAssignedBranches.map((b) => b.name).join(", ")
                : "-"}
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>
              Гарын үсгийн зураг (URL)
            </div>
            <div>{doctor.signatureImagePath || "-"}</div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>
              Тамганы зураг (URL)
            </div>
            <div>{doctor.stampImagePath || "-"}</div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 600,
          }}
        >
          {(
            [
              { label: "Овог", name: "ovog", type: "text" },
              { label: "Нэр", name: "name", type: "text" },
              { label: "И-мэйл", name: "email", type: "email" },
            ] as const
          ).map((f) => (
            <div key={f.name}>
              <div style={{ color: "#6b7280", marginBottom: 2, fontSize: 13 }}>
                {f.label}
              </div>
              <input
                name={f.name}
                type={f.type}
                value={(form as any)[f.name]}
                onChange={handleChange}
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
            </div>
          ))}

          <div>
            <div style={{ color: "#6b7280", marginBottom: 2, fontSize: 13 }}>
              Үндсэн салбар
            </div>
            <select
              name="branchId"
              value={form.branchId}
              onChange={handleChange}
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "4px 6px",
                background: "white",
              }}
            >
              <option value="">Сонгохгүй</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {(
            [
              { label: "РД", name: "regNo", type: "text" },
              { label: "Утас", name: "phone", type: "text" },
              { label: "Лицензийн дугаар", name: "licenseNumber", type: "text" },
              {
                label: "Лиценз дуусах хугацаа",
                name: "licenseExpiryDate",
                type: "date",
              },
              {
                label: "Гарын үсгийн зураг (URL)",
                name: "signatureImagePath",
                type: "text",
              },
              { label: "Тамганы зураг (URL)", name: "stampImagePath", type: "text" },
            ] as const
          ).map((f) => (
            <div key={f.name}>
              <div style={{ color: "#6b7280", marginBottom: 2, fontSize: 13 }}>
                {f.label}
              </div>
              <input
                name={f.name}
                type={f.type}
                value={(form as any)[f.name]}
                onChange={handleChange}
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "4px 6px",
                }}
              />
            </div>
          ))}

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setError(null);
                resetFormFromDoctor();
                setIsEditingProfile(false);
              }}
              disabled={saving}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                fontSize: 13,
                cursor: saving ? "default" : "pointer",
              }}
            >
              Болих
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: saving ? "#9ca3af" : "#2563eb",
                color: "white",
                fontSize: 13,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
          </div>
        </form>
      )}
    </div>

    {/* Branch assignment - render in patient-card style */}
    <div
      style={{
        marginTop: 16,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: 16,
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 0 }}>
          Салбарын тохиргоо
        </h2>

        <button
          type="button"
          onClick={handleSaveBranches}
          disabled={savingBranches}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: savingBranches ? "#9ca3af" : "#059669",
            color: "white",
            fontSize: 13,
            cursor: savingBranches ? "default" : "pointer",
          }}
        >
          {savingBranches ? "Салбар хадгалж байна..." : "Салбар хадгалах"}
        </button>
      </div>

      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
        Энэ эмч аль салбаруудад ажиллахыг доороос сонгоно уу.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {branches.map((b) => (
          <label
            key={b.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={selectedBranchIds.includes(b.id)}
              onChange={() => toggleBranch(b.id)}
            />
            {b.name}
          </label>
        ))}
      </div>
    </div>
  </>
)}

          {/* SCHEDULE TAB */}
          {activeTab === "schedule" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card title="Ажлын хуваарь шинээр нэмэх">
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                  Сонгосон өдөр, салбар, ээлжийн дагуу шинэ ажлын хуваарь үүсгэнэ.
                </div>

                <form
                  onSubmit={handleSaveSchedule}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    maxWidth: 600,
                  }}
                >
                 <div>
                    <div style={labelStyle}>Огноо</div>
                  <input
                    style={inputStyle}
                      type="date"
                      name="date"
                      value={scheduleForm.date}
                      onChange={handleScheduleFormChange}
                    />
                </div>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Салбар
                    <select
                      name="branchId"
                      value={scheduleForm.branchId}
                      onChange={handleScheduleFormChange}
                    >
                      <option value="">Сонгох</option>
                      {doctorAssignedBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Ээлж
                    <select
                      name="shiftType"
                      value={scheduleForm.shiftType}
                      onChange={handleScheduleFormChange}
                    >
                      <option value="AM">Өглөө ээлж</option>
                      <option value="PM">Орой ээлж</option>
                      <option value="WEEKEND_FULL">Амралтын өдөр</option>
                    </select>
                  </label>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      Эхлэх цаг
                      <input
                        type="time"
                        name="startTime"
                        value={scheduleForm.startTime}
                        onChange={handleScheduleFormChange}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      Дуусах цаг
                      <input
                        type="time"
                        name="endTime"
                        value={scheduleForm.endTime}
                        onChange={handleScheduleFormChange}
                      />
                    </label>
                  </div>


                  
                  <div>
  <div style={labelStyle}>Тэмдэглэл</div>
                    <textarea
                      style={inputStyle}
                      name="note"
                      rows={2}
                      value={scheduleForm.note}
                      onChange={handleScheduleFormChange}
                      placeholder="Жишээ нь: 30 минут хоцорч эхэлнэ"
                    />
                 </div>

                  <button
                    type="submit"
                    disabled={scheduleSaving || !isCreatingSchedule}
                    style={{
                      marginTop: 4,
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#7c3aed",
                      color: "white",
                      cursor: "pointer",
                      alignSelf: "flex-start",
                      fontWeight: 700,
                    }}
                  >
                    {scheduleSaving ? "Хуваарь хадгалж байна..." : "Хуваарь хадгалах"}
                  </button>

                  {scheduleSaveError && (
                    <div style={{ color: "red", marginTop: 4 }}>
                      {scheduleSaveError}
                    </div>
                  )}
                  {scheduleSaveSuccess && (
                    <div style={{ color: "green", marginTop: 4 }}>
                      {scheduleSaveSuccess}
                    </div>
                  )}
                </form>
              </Card>

              <Card title="Дараагийн 1 сарын ажлын хуваарь">
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                  Нийт төлөвлөгдсөн хуваарь
                </div>

                {scheduleLoading && <div>Ажлын хуваарь ачааллаж байна...</div>}

                {!scheduleLoading && scheduleError && (
                  <div style={{ color: "red" }}>{scheduleError}</div>
                )}

                {!scheduleLoading && !scheduleError && schedule.length === 0 && (
                  <div style={{ color: "#888" }}>Төлөвлөсөн ажлын хуваарь алга.</div>
                )}

                {!scheduleLoading && !scheduleError && schedule.length > 0 && (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginTop: 8,
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Огноо
                        </th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Салбар
                        </th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Цаг
                        </th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Тэмдэглэл
                        </th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Үйлдэл
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((s) => {
                        const isRowEditing = editingScheduleId === s.id;

                        return (
                          <tr key={s.id}>
                            <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                              {isRowEditing ? (
                                <input
                                  type="date"
                                  name="date"
                                  value={inlineForm.date}
                                  onChange={handleInlineChange}
                                  style={{ fontSize: 12, padding: 4 }}
                                />
                              ) : (
                                new Date(s.date).toLocaleDateString("mn-MN", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  weekday: "short",
                                })
                              )}
                            </td>

                            <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                              {isRowEditing ? (
                                <select
                                  name="branchId"
                                  value={inlineForm.branchId}
                                  onChange={handleInlineChange}
                                  style={{ fontSize: 12, padding: 4 }}
                                >
                                  <option value="">Сонгох</option>
                                  {doctorAssignedBranches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                s.branch?.name || "-"
                              )}
                            </td>

                            <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                              {isRowEditing ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <input
                                    type="time"
                                    name="startTime"
                                    value={inlineForm.startTime}
                                    onChange={handleInlineChange}
                                    style={{ fontSize: 12, padding: 4 }}
                                  />
                                  <span>-</span>
                                  <input
                                    type="time"
                                    name="endTime"
                                    value={inlineForm.endTime}
                                    onChange={handleInlineChange}
                                    style={{ fontSize: 12, padding: 4 }}
                                  />
                                </div>
                              ) : (
                                <>
                                  {s.startTime} - {s.endTime}
                                </>
                              )}
                            </td>

                            <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                              {isRowEditing ? (
                                <textarea
                                  name="note"
                                  rows={1}
                                  value={inlineForm.note}
                                  onChange={handleInlineChange}
                                  style={{ fontSize: 12, padding: 4, width: "100%" }}
                                />
                              ) : (
                                s.note || "-"
                              )}
                            </td>

                            <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                              {isRowEditing ? (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={handleInlineSaveSchedule}
                                    disabled={scheduleSaving}
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #4ade80",
                                      background: "#dcfce7",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {scheduleSaving ? "Хадгалж..." : "Хадгалах"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditRow}
                                    style={{
                                     border: "1px solid #d1d5db",
background: "#f9fafb",
padding: "6px 12px",
borderRadius: 6,
fontSize: 13
                                    }}
                                  >
                                    Цуцлах
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => startEditRow(s)}
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #d1d5db",
                                      background: "#fff",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Засах
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSchedule(s.id)}
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #fecaca",
                                      background: "#fee2e2",
                                      color: "#b91c1c",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Устгах
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>

              <Card title="Хуваарийн түүх">
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                  Өнгөрсөн (эсвэл ирээдүйн) тодорхой хугацааны ажлын хуваарийг харах.
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "flex-end",
                    marginBottom: 12,
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Эхлэх огноо
                    <input
                      type="date"
                      value={historyFrom}
                      onChange={(e) => setHistoryFrom(e.target.value)}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    Дуусах огноо
                    <input
                      type="date"
                      value={historyTo}
                      onChange={(e) => setHistoryTo(e.target.value)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={loadHistory}
                    disabled={historyLoading}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#0f766e",
                      color: "white",
                      cursor: "pointer",
                      height: 38,
                      fontWeight: 700,
                    }}
                  >
                    {historyLoading ? "Ачааллаж байна..." : "Харах"}
                  </button>
                </div>

                {historyError && (
                  <div style={{ color: "red", marginBottom: 8 }}>{historyError}</div>
                )}

                {!historyLoading && historyItems.length === 0 && !historyError && (
                  <div style={{ color: "#888" }}>
                    Хуваарийн түүх хараахан ачаалаагүй эсвэл өгөгдөл олдсонгүй.
                  </div>
                )}

                {historyItems.length > 0 && (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginTop: 8,
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Огноо
                        </th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Салбар
                        </th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Цаг
                        </th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                          Тэмдэглэл
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((s) => (
                        <tr key={s.id}>
                          <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                            {new Date(s.date).toLocaleDateString("mn-MN", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              weekday: "short",
                            })}
                          </td>
                          <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                            {s.branch?.name || "-"}
                          </td>
                          <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                            {s.startTime} - {s.endTime}
                          </td>
                          <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                            {s.note || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}

          {activeTab === "appointments" && (
            <Card title="Цагууд">
              {/* Date Range Filter */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 16,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "0 0 auto" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      marginBottom: 4,
                      color: "#374151",
                    }}
                  >
                    Эхлэх өдөр:
                  </label>
                  <input
                    type="date"
                    value={appointmentsFrom}
                    onChange={(e) => setAppointmentsFrom(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      marginBottom: 4,
                      color: "#374151",
                    }}
                  >
                    Дуусах өдөр:
                  </label>
                  <input
                    type="date"
                    value={appointmentsTo}
                    onChange={(e) => setAppointmentsTo(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 14,
                    }}
                  />
                </div>
                <button
                  onClick={loadAppointments}
                  disabled={appointmentsLoading || !appointmentsFrom || !appointmentsTo}
                  style={{
                    padding: "8px 16px",
                    background: appointmentsLoading ? "#9ca3af" : "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: appointmentsLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {appointmentsLoading ? "Ачаалж байна..." : "Харах"}
                </button>
              </div>

              {/* Loading State */}
              {appointmentsLoading && (
                <div style={{ color: "#6b7280", fontSize: 14, padding: "20px 0" }}>
                  Цагуудыг ачаалж байна...
                </div>
              )}

              {/* Error State */}
              {appointmentsError && !appointmentsLoading && (
                <div style={{ color: "#dc2626", fontSize: 14, padding: "12px 0" }}>
                  {appointmentsError}
                </div>
              )}

              {/* Empty State */}
              {!appointmentsLoading &&
                !appointmentsError &&
                appointments.length === 0 && (
                  <div style={{ color: "#6b7280", fontSize: 14, padding: "20px 0" }}>
                    Тухайн хугацаанд цаг олдсонгүй.
                  </div>
                )}

              {/* Appointments Table */}
              {!appointmentsLoading &&
                !appointmentsError &&
                appointments.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 14,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: "2px solid #e5e7eb",
                            backgroundColor: "#f9fafb",
                          }}
                        >
                          <th
                            style={{
                              padding: "10px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            Огноо
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            Цаг
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            Өвчтөн
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            Төлөв
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            Салбар
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            Үйлдэл
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((appt) => {
                          const scheduledDate = appt.scheduledAt
                            ? new Date(appt.scheduledAt)
                            : null;
                          const dateStr = scheduledDate
                            ? scheduledDate.toISOString().slice(0, 10)
                            : "";
                          const timeStr = scheduledDate
                            ? scheduledDate.toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";
                          const endTimeStr =
                            appt.endAt && new Date(appt.endAt)
                              ? new Date(appt.endAt).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "";

                          const patientFullName = [appt.patientOvog, appt.patientName]
                            .filter(Boolean)
                            .join(" ");

                          return (
                            <tr
                              key={appt.id}
                              style={{
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              <td style={{ padding: "10px 8px" }}>{dateStr}</td>
                              <td style={{ padding: "10px 8px" }}>
                                {timeStr}
                                {endTimeStr && ` - ${endTimeStr}`}
                              </td>
                              <td style={{ padding: "10px 8px" }}>
                                {patientFullName || "—"}
                              </td>
                              <td style={{ padding: "10px 8px" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    backgroundColor:
                                      appt.status === "completed"
                                        ? "#d1fae5"
                                        : appt.status === "ongoing"
                                        ? "#fef3c7"
                                        : "#dbeafe",
                                    color:
                                      appt.status === "completed"
                                        ? "#065f46"
                                        : appt.status === "ongoing"
                                        ? "#92400e"
                                        : "#1e40af",
                                  }}
                                >
                                  {appt.status}
                                </span>
                              </td>
                              <td style={{ padding: "10px 8px" }}>
                                {appt.branchName || `#${appt.branchId}`}
                              </td>
                              <td style={{ padding: "10px 8px" }}>
                                {appt.patientBookNumber ? (
                                  <button
                                    onClick={() =>
                                      router.push(
                                        `/patients/${appt.patientBookNumber}`
                                      )
                                    }
                                    style={{
                                      padding: "4px 12px",
                                      backgroundColor: "#3b82f6",
                                      color: "white",
                                      border: "none",
                                      borderRadius: 4,
                                      fontSize: 13,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Харах
                                  </button>
                                ) : (
                                  <span style={{ color: "#9ca3af", fontSize: 12 }}>
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </Card>
          )}

          {activeTab === "test1" && (
            <Card title="Test Page 1">
              <div style={{ color: "#6b7280", fontSize: 13 }}>Placeholder page.</div>
            </Card>
          )}

          {activeTab === "test2" && (
            <Card title="Test Page 2">
              <div style={{ color: "#6b7280", fontSize: 13 }}>Placeholder page.</div>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
