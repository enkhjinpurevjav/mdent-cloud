import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type Branch = {
  id: number;
  name: string;
};

type Reception = {
  id: number;
  email: string;
  name?: string;
  ovog?: string | null;
  role: string;
  branchId?: number | null;
  regNo?: string | null;
  phone?: string | null;
  branch?: Branch | null;
};

type ReceptionScheduleDay = {
  id: number;
  date: string; // "YYYY-MM-DD"
  branch: Branch;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  note?: string | null;
};

type ShiftType = "AM" | "PM" | "WEEKEND_FULL";

export default function ReceptionProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [reception, setReception] = useState<Reception | null>(null);
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
    phone: "",
  });

  // selected multiple branches (ReceptionBranch)
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  // schedule state (next 31 days)
  const [schedule, setSchedule] = useState<ReceptionScheduleDay[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // schedule editor form state (create only)
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

      if (name === "shiftType") {
        const shift = value as ShiftType;

        if (prev.date) {
          const d = new Date(prev.date);
          const day = d.getDay();
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

  // Load branches + receptionist + schedule
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

      // load user (defensive JSON parsing)
      const rRes = await fetch(`/api/users/${id}`);

      let rData: any = null;
      try {
        rData = await rRes.json();
      } catch {
        rData = null;
      }

      if (!rRes.ok || !rData) {
        setError(
          (rData && rData.error) ||
            "Ресепшний мэдээллийг ачааллаж чадсангүй"
        );
        setLoading(false);
        return;
      }

      const rec: Reception = rData;
      setReception(rec);

      setForm({
        name: rec.name || "",
        ovog: rec.ovog || "",
        email: rec.email || "",
        branchId: rec.branchId ? String(rec.branchId) : "",
        regNo: rec.regNo || "",
        phone: rec.phone || "",
      });

      // initial multi-branch selection
      const initialBranchIds =
        rData.branches && Array.isArray(rData.branches)
          ? (rData.branches as Branch[]).map((b) => b.id)
          : rec.branchId
          ? [rec.branchId]
          : [];
      setSelectedBranchIds(initialBranchIds);

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
        `/api/users/${id}/reception-schedule?from=${from}&to=${to}`
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

      const res = await fetch(
        `/api/users/${id}/reception-schedule?from=${from}&to=${to}`
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
        branchId: form.branchId ? Number(form.branchId) : null,
        regNo: form.regNo || null,
        phone: form.phone || null,
        // NO license fields for reception
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

      setReception(data);
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

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(
        (data && (data as any).error) ||
          "Салбар хадгалах үед алдаа гарлаа"
      );
      setSavingBranches(false);
      return;
    }
  } catch (err) {
    console.error(err);
    setError("Сүлжээгээ шалгана уу");
  } finally {
    setSavingBranches(false);
  }
};

  const handleDeleteUser = async () => {
    if (!id) return;

    const ok = window.confirm(
      "Та энэхүү ресепшний аккаунтыг устгахдаа итгэлтэй байна уу?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert((data && (data as any).error) || "Устгах үед алдаа гарлаа");
        return;
      }

      router.push("/users/reception");
    } catch (err) {
      console.error(err);
      alert("Сүлжээгээ шалгана уу");
    }
  };

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

      const res = await fetch(`/api/users/${id}/reception-schedule`, {
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

  const startEditRow = (s: ReceptionScheduleDay) => {
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

      const res = await fetch(`/api/users/${id}/reception-schedule`, {
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
      const res = await fetch(
        `/api/users/${id}/reception-schedule/${scheduleId}`,
        {
          method: "DELETE",
        }
      );

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

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div>Ачааллаж байна...</div>
      </div>
    );
  }

  if (error && !reception) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Ресепшний мэдээлэл</h1>
        <div style={{ color: "red", marginTop: 8 }}>{error}</div>
      </div>
    );
  }

  if (!reception) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Ресепшн олдсонгүй</h1>
      </div>
    );
  }

  const headerName =
    reception.name && reception.name.trim().length > 0
      ? reception.name
      : reception.email;

  const receptionAssignedBranches: Branch[] =
    selectedBranchIds.length > 0
      ? branches.filter((b) => selectedBranchIds.includes(b.id))
      : branches;

  const isCreatingSchedule =
    !!scheduleForm.date &&
    !!scheduleForm.branchId &&
    editingScheduleId === null;

  return (
    <div style={{ padding: 24 }}>
      <button
        onClick={() => router.back()}
        style={{
          marginBottom: 16,
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid #ddd",
          cursor: "pointer",
        }}
      >
        &larr; Буцах
      </button>

      <h1>Ресепшн: {headerName}</h1>

      {/* Basic info form */}
      <form
        onSubmit={handleSave}
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 500,
        }}
      >
        {/* Portrait placeholder (no upload yet, same look as doctor) */}
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
              borderRadius: 8,
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
            <span>Зураг байрлах хэсэг</span>
          </div>
        </div>

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

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Үндсэн салбар
          <select
            name="branchId"
            value={form.branchId}
            onChange={handleChange}
          >
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

        {/* No license number / expiry for reception */}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "8px 16px",
              borderRadius: 4,
              border: "none",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
            }}
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>

          <button
            type="button"
            onClick={handleDeleteUser}
            style={{
              padding: "8px 16px",
              borderRadius: 4,
              border: "1px solid #fecaca",
              background: "#fee2e2",
              color: "#b91c1c",
              cursor: "pointer",
            }}
          >
            Ажилтныг устгах
          </button>
        </div>

        {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      </form>

      {/* Branch config */}
      <section style={{ marginTop: 32, maxWidth: 500 }}>
        <h2>Салбарын тохиргоо</h2>
        <p style={{ color: "#555", marginBottom: 8 }}>
          Энэ ресепшн аль салбаруудад ажиллахыг доороос сонгоно уу.
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
                gap: 4,
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

        <button
          type="button"
          onClick={handleSaveBranches}
          disabled={savingBranches}
          style={{
            marginTop: 4,
            padding: "8px 16px",
            borderRadius: 4,
            border: "none",
            background: "#059669",
            color: "white",
            cursor: "pointer",
          }}
        >
          {savingBranches ? "Салбар хадгалж байна..." : "Салбар хадгалах"}
        </button>
      </section>

      {/* Schedule create form */}
      <section style={{ marginTop: 32, maxWidth: 600 }}>
        <h2>Ажлын хуваарь шинээр нэмэх</h2>
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
              {receptionAssignedBranches.map((b) => (
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

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <label
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              Эхлэх цаг
              <input
                type="time"
                name="startTime"
                value={scheduleForm.startTime}
                onChange={handleScheduleFormChange}
              />
            </label>
            <label
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
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
              borderRadius: 4,
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
      </section>

      {/* Upcoming schedule table */}
      <section style={{ marginTop: 32, maxWidth: 800 }}>
        <h2>Дараагийн 1 сарын ажлын хуваарь</h2>
        <p style={{ color: "#555", marginBottom: 8 }}>
          Нийт төлөвлөгдсөн хуваарь
        </p>

        {scheduleLoading && <div>Ажлын хуваарь ачааллаж байна...</div>}

        {!scheduleLoading && scheduleError && (
          <div style={{ color: "red" }}>{scheduleError}</div>
        )}

        {!scheduleLoading && !scheduleError && schedule.length === 0 && (
          <div style={{ color: "#888" }}>
            Төлөвлөсөн ажлын хуваарь алга.
          </div>
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
                          {receptionAssignedBranches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        s.branch?.name || "-"
                      )}
                    </td>

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
                              borderRadius: 4,
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
                              borderRadius: 4,
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
                              borderRadius: 4,
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
                              borderRadius: 4,
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
    </div>
  );
}
