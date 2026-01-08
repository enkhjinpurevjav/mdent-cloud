import React, { useEffect, useMemo, useState } from "react";
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
type ReceptionTabKey = "profile" | "schedule";

export default function ReceptionProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [reception, setReception] = useState<Reception | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBranches, setSavingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ReceptionTabKey>("profile");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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

  const resetFormFromReception = () => {
    if (!reception) return;
    setForm({
      name: reception.name || "",
      ovog: reception.ovog || "",
      email: reception.email || "",
      branchId: reception.branchId ? String(reception.branchId) : "",
      regNo: reception.regNo || "",
      phone: reception.phone || "",
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
              "Ресепшний мэдээллийг ачаалж чадсангүй"
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

        setIsEditingProfile(false);
        setActiveTab("profile");

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

  const headerName =
    reception?.name && reception.name.trim().length > 0
      ? reception.name
      : reception?.email;

  const mainBranchName = useMemo(() => {
    if (!reception?.branchId) return null;
    return branches.find((b) => b.id === reception.branchId)?.name || null;
  }, [reception?.branchId, branches]);

  const receptionAssignedBranches: Branch[] =
    selectedBranchIds.length > 0
      ? branches.filter((b) => selectedBranchIds.includes(b.id))
      : branches;

  const isCreatingSchedule =
    !!scheduleForm.date &&
    !!scheduleForm.branchId &&
    editingScheduleId === null;

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
        onClick={() => router.push("/users/reception")}
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

          {/* Portrait placeholder */}
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
            <span>Зураг байрлах хэсэг</span>
          </div>

          <div style={{ fontSize: 13, color: "#6b7280" }}>
            <div>Утас: {reception.phone || "-"}</div>
            <div>И-мэйл: {reception.email || "-"}</div>
            <div>Үндсэн салбар: {mainBranchName || "-"}</div>
          </div>

          {/* Side menu (2 tabs) */}
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
                  background:
                    activeTab === "profile" ? "#eff6ff" : "transparent",
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
                  background:
                    activeTab === "schedule" ? "#eff6ff" : "transparent",
                  color: activeTab === "schedule" ? "#1d4ed8" : "#6b7280",
                  fontWeight: activeTab === "schedule" ? 500 : 400,
                  cursor: "pointer",
                }}
              >
                Ажлын хуваарь
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
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <>
              {/* Basic information (view/edit) */}
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
                  <div
                    style={{
                      color: "#b91c1c",
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    {error}
                  </div>
                )}

                {!isEditingProfile ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ color: "#6b7280", marginBottom: 2 }}>
                        Овог
                      </div>
                      <div>{reception.ovog || "-"}</div>
                    </div>

                    <div>
                      <div style={{ color: "#6b7280", marginBottom: 2 }}>
                        Нэр
                      </div>
                      <div>{reception.name || "-"}</div>
                    </div>

                    <div>
                      <div style={{ color: "#6b7280", marginBottom: 2 }}>
                        И-мэйл
                      </div>
                      <div>{reception.email || "-"}</div>
                    </div>

                    <div>
                      <div style={{ color: "#6b7280", marginBottom: 2 }}>
                        Утас
                      </div>
                      <div>{reception.phone || "-"}</div>
                    </div>

                    <div>
                      <div style={{ color: "#6b7280", marginBottom: 2 }}>
                        РД
                      </div>
                      <div>{reception.regNo || "-"}</div>
                    </div>

                    <div>
                      <div style={{ color: "#6b7280", marginBottom: 2 }}>
                        Үндсэн салбар
                      </div>
                      <div>{mainBranchName || reception.branchId || "-"}</div>
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
                        { label: "РД", name: "regNo", type: "text" },
                        { label: "Утас", name: "phone", type: "text" },
                      ] as const
                    ).map((f) => (
                      <div key={f.name}>
                        <div
                          style={{
                            color: "#6b7280",
                            marginBottom: 2,
                            fontSize: 13,
                          }}
                        >
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
                      <div
                        style={{
                          color: "#6b7280",
                          marginBottom: 2,
                          fontSize: 13,
                        }}
                      >
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
                          resetFormFromReception();
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

              {/* Branch assignment */}
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
                    {savingBranches
                      ? "Салбар хадгалж байна..."
                      : "Салбар хадгалах"}
                  </button>
                </div>

                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                  Энэ ресепшн аль салбаруудад ажиллахыг доороос сонгоно уу.
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
              {/* Schedule create form */}
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 16,
                  background: "white",
                }}
              >
                <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 8 }}>
                  Ажлын хуваарь шинээр нэмэх
                </h2>
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
                      borderRadius: 6,
                      border: "none",
                      background: "#7c3aed",
                      color: "white",
                      cursor: "pointer",
                      alignSelf: "flex-start",
                      fontWeight: 700,
                      fontSize: 13,
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
              </div>

              {/* Upcoming schedule table */}
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 16,
                  background: "white",
                }}
              >
                <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 8 }}>
                  Дараагийн 1 сарын ажлын хуваарь
                </h2>
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                  Нийт төлөвлөгдсөн хуваарь
                </div>

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
                      <tr style={{ background: "#f9fafb" }}>
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
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
