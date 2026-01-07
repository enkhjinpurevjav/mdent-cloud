import React, { useEffect, useState } from "react";
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

  calendarOrder?: number | null; // NEW
};

type DoctorScheduleDay = {
  id: number;
  date: string; // "YYYY-MM-DD"
  branch: Branch;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  note?: string | null;
};

type ShiftType = "AM" | "PM" | "WEEKEND_FULL";

export default function DoctorProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBranches, setSavingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [scheduleSaveSuccess, setScheduleSaveSuccess] = useState<
    string | null
  >(null);

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
            // Weekend logic
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
            // Weekday logic
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
          // No date yet; use default weekday templates
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

    load();
    loadSchedule();
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
            : "Ажлын хуваарийг ачааллаж чадсангүй"
        );
      }
    } catch (err) {
      console.error(err);
      setScheduleError("Сүлжээгээ шалгана уу");
    } finally {
      setScheduleLoading(false);
    }
  };

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
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

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

      // after delete, go back to doctors list
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

      // reset create form after successful save
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

  // Inline edit helpers (ONLY for editing existing rows)
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

  // Delete a schedule row with confirmation
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
          (data && (data as any).error) || "Хуваарь устгах үед алдаа гарлаа"
        );
        return;
      }

      setSchedule((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch (err) {
      console.error(err);
      setScheduleSaveError("Сүлжээгээ шалгана уу");
    }
  };

  // Load history between historyFrom/historyTo
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

  const headerName =
    doctor.name && doctor.name.trim().length > 0 ? doctor.name : doctor.email;

  // Only allow selecting branches that this doctor is assigned to
  const doctorAssignedBranches: Branch[] =
    doctor.branches && doctor.branches.length > 0 ? doctor.branches : branches;

  const isCreatingSchedule =
    !!scheduleForm.date &&
    !!scheduleForm.branchId &&
    editingScheduleId === null;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      {/* Header */}
      <section style={{ marginBottom: 16 }}>
        <button
          onClick={() => router.back()}
          style={{
            marginBottom: 12,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← Буцах
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>Эмч: {headerName}</h1>
            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
              Эмчийн профайл, салбарын тохиргоо болон ажлын хуваарь.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                color: "#374151",
              }}
            >
              Role: {doctor.role}
            </span>
            {doctorAssignedBranches?.length ? (
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  color: "#374151",
                }}
              >
                Салбар: {doctorAssignedBranches.map((b) => b.name).join(", ")}
              </span>
            ) : null}
          </div>
        </div>

        {error && (
          <div style={{ color: "#b91c1c", marginTop: 10, fontSize: 13 }}>
            {error}
          </div>
        )}
      </section>

      {/* Two-column layout */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* LEFT: profile summary */}
        <aside
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            padding: 14,
          }}
        >
          {/* Portrait photo */}
          <div
            style={{
              marginBottom: 12,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 160,
                height: 200,
                borderRadius: 10,
                border: "2px dashed #9ca3af",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f9fafb",
                color: "#6b7280",
                fontSize: 12,
                overflow: "hidden",
              }}
            >
              {doctor.idPhotoPath ? (
                <img
                  src={doctor.idPhotoPath}
                  alt="Эмчийн зураг"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
              ) : (
                <span>Зураг байрлах хэсэг</span>
              )}
            </div>
          </div>

          {/* Summary rows */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>И-мэйл</div>
              <div style={{ fontWeight: 600 }}>{doctor.email}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Утас</div>
              <div style={{ fontWeight: 600 }}>{doctor.phone || "—"}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>РД</div>
              <div style={{ fontWeight: 600 }}>{doctor.regNo || "—"}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Үндсэн салбар</div>
              <div style={{ fontWeight: 600 }}>
                {doctor.branchId
                  ? branches.find((b) => b.id === doctor.branchId)?.name ||
                    String(doctor.branchId)
                  : "—"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                Ажиллах салбарууд
              </div>
              <div style={{ fontWeight: 600 }}>
                {doctorAssignedBranches?.length
                  ? doctorAssignedBranches.map((b) => b.name).join(", ")
                  : "—"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Лиценз</div>
              <div style={{ fontWeight: 600 }}>{doctor.licenseNumber || "—"}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                Дуусах:{" "}
                {doctor.licenseExpiryDate
                  ? doctor.licenseExpiryDate.slice(0, 10)
                  : "—"}
              </div>
            </div>
          </div>

          {/* Delete button */}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={handleDeleteUser}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fee2e2",
                color: "#b91c1c",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Ажилтныг устгах
            </button>
          </div>
        </aside>

        {/* RIGHT: main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Basic info form */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Үндсэн мэдээлэл</h2>
            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
              Эмчийн мэдээлэл засварлах хэсэг.
            </div>

            <form
              onSubmit={handleSave}
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                maxWidth: 560,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Овог
                <input
                  name="ovog"
                  value={form.ovog}
                  onChange={handleChange}
                  placeholder="Овог"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Нэр
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Нэр"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                И-мэйл
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="И-мэйл"
                />
              </label>

              {/* Legacy single branch select */}
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Үндсэн салбар
                <select name="branchId" value={form.branchId} onChange={handleChange}>
                  <option value="">Сонгохгүй</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                РД
                <input
                  name="regNo"
                  value={form.regNo}
                  onChange={handleChange}
                  placeholder="РД"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Утас
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Утас"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Лицензийн дугаар
                <input
                  name="licenseNumber"
                  value={form.licenseNumber}
                  onChange={handleChange}
                  placeholder="Лицензийн дугаар"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Лиценз дуусах хугацаа
                <input
                  name="licenseExpiryDate"
                  type="date"
                  value={form.licenseExpiryDate}
                  onChange={handleChange}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Гарын үсгийн зураг (URL)
                <input
                  name="signatureImagePath"
                  value={form.signatureImagePath}
                  onChange={handleChange}
                  placeholder="Жишээ: /uploads/signatures/doctor1.png"
                />
              </label>

              {doctor.signatureImagePath && (
                <div
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#555" }}>
                    Одоогийн гарын үсэг
                  </span>
                  <img
                    src={doctor.signatureImagePath}
                    alt="Эмчийн гарын үсэг"
                    style={{
                      maxWidth: 200,
                      maxHeight: 80,
                      objectFit: "contain",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      background: "white",
                    }}
                  />
                </div>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Тамганы зураг (URL)
                <input
                  name="stampImagePath"
                  value={form.stampImagePath}
                  onChange={handleChange}
                  placeholder="Жишээ: /uploads/stamps/doctor1.png"
                />
              </label>

              {doctor.stampImagePath && (
                <div
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#555" }}>
                    Одоогийн тамга
                  </span>
                  <img
                    src={doctor.stampImagePath}
                    alt="Эмчийн тамга"
                    style={{
                      maxWidth: 160,
                      maxHeight: 160,
                      objectFit: "contain",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      background: "white",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {saving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>

              {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
            </form>
          </section>

          {/* Multi-branch assignment */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 16,
              maxWidth: 600,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Салбарын тохиргоо</h2>
            <p style={{ color: "#555", marginBottom: 8 }}>
              Энэ эмч аль салбаруудад ажиллахыг доороос сонгоно уу.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {branches.map((b) => (
                <label
                  key={b.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid #e5e7eb",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 13,
                    background: selectedBranchIds.includes(b.id)
                      ? "#eff6ff"
                      : "#ffffff",
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

            <button
              type="button"
              onClick={handleSaveBranches}
              disabled={savingBranches}
              style={{
                marginTop: 4,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#059669",
                color: "white",
                cursor: "pointer",
              }}
            >
              {savingBranches ? "Салбар хадгалж байна..." : "Салбар хадгалах"}
            </button>
          </section>

          {/* Schedule editor form (create only) */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 16,
              maxWidth: 600,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
              Ажлын хуваарь шинээр нэмэх
            </h2>
            <p style={{ color: "#555", marginBottom: 8 }}>
              Сонгосон өдөр, салбар, ээлжийн дагуу шинэ ажлын хуваарь үүсгэнэ.
            </p>

            <form
              onSubmit={handleSaveSchedule}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxWidth: 600,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Огноо
                <input
                  type="date"
                  name="date"
                  value={scheduleForm.date}
                  onChange={handleScheduleFormChange}
                />
              </label>

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

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                Тэмдэглэл
                <textarea
                  name="note"
                  rows={2}
                  value={scheduleForm.note}
                  onChange={handleScheduleFormChange}
                  placeholder="Жишээ нь: 30 минут хоцорч эхэлнэ"
                />
              </label>

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
                }}
              >
                {scheduleSaving ? "Хуваарь хадгалж байна..." : "Хуваарь хадгалах"}
              </button>

              {scheduleSaveError && (
                <div style={{ color: "red", marginTop: 4 }}>{scheduleSaveError}</div>
              )}
              {scheduleSaveSuccess && (
                <div style={{ color: "green", marginTop: 4 }}>{scheduleSaveSuccess}</div>
              )}
            </form>
          </section>

          {/* Work schedule (next 31 days) */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 16,
              maxWidth: 900,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
              Дараагийн 1 сарын ажлын хуваарь
            </h2>
            <p style={{ color: "#555", marginBottom: 8 }}>
              Нийт төлөвлөгдсөн хуваарь
            </p>

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
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Огноо
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Салбар
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Цаг
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Тэмдэглэл
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Үйлдэл
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((s) => {
                    const isRowEditing = editingScheduleId === s.id;

                    return (
                      <tr key={s.id}>
                        {/* Date */}
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 8,
                          }}
                        >
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

                        {/* Branch */}
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 8,
                          }}
                        >
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

                        {/* Time */}
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 8,
                          }}
                        >
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

                        {/* Note */}
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 8,
                          }}
                        >
                          {isRowEditing ? (
                            <textarea
                              name="note"
                              rows={1}
                              value={inlineForm.note}
                              onChange={handleInlineChange}
                              style={{
                                fontSize: 12,
                                padding: 4,
                                width: "100%",
                              }}
                            />
                          ) : (
                            s.note || "-"
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          style={{
                            borderBottom: "1px solid #f0f0f0",
                            padding: 8,
                          }}
                        >
                          {isRowEditing ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                onClick={handleInlineSaveSchedule}
                                disabled={scheduleSaving}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #4ade80",
                                  background: "#dcfce7",
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                {scheduleSaving ? "Хадгалж..." : "Хадгалах"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditRow}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: "#f9fafb",
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                Цуцлах
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => startEditRow(s)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: "#f9fafb",
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                Засах
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSchedule(s.id)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #fecaca",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  cursor: "pointer",
                                  fontSize: 12,
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
          </section>

          {/* Schedule history */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 16,
              maxWidth: 900,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
              Хуваарийн түүх
            </h2>
            <p style={{ color: "#555", marginBottom: 8 }}>
              Өнгөрсөн (эсвэл ��рээдүйн) тодорхой хугацааны ажлын хуваарийг харах.
            </p>

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
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Огноо
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Салбар
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Цаг
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Тэмдэглэл
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((s) => (
                    <tr key={s.id}>
                      <td
                        style={{
                          borderBottom: "1px solid #f0f0f0",
                          padding: 8,
                        }}
                      >
                        {new Date(s.date).toLocaleDateString("mn-MN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          weekday: "short",
                        })}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f0f0f0",
                          padding: 8,
                        }}
                      >
                        {s.branch?.name || "-"}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f0f0f0",
                          padding: 8,
                        }}
                      >
                        {s.startTime} - {s.endTime}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f0f0f0",
                          padding: 8,
                        }}
                      >
                        {s.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
