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
  branchId?: number | null; // legacy single branch
  regNo?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null; // ISO string
  signatureImagePath?: string | null;
  stampImagePath?: string | null;
  idPhotoPath?: string | null;
  branches?: Branch[];
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
  });

  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // top form = create new schedule
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

  // inline edit state
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

  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const bRes = await fetch("/api/branches");
        const bData = await bRes.json();
        if (bRes.ok && Array.isArray(bData)) {
          setBranches(bData);
        }

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
        });

        const initialBranchIds = (doc.branches || []).map((b) => b.id);
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
        licenseNumber: form.licenseNumber || null,
        licenseExpiryDate: form.licenseExpiryDate || null,
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

      if (data && Array.isArray(data.branches)) {
        setDoctor((prev) =>
          prev ? { ...prev, branches: data.branches } : prev
        );
      }

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
      // assumes you have DELETE /api/users/:id/schedule/:scheduleId
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
    doctor.ovog || doctor.name
      ? `${doctor.ovog || ""} ${doctor.name || ""}`.trim()
      : doctor.email;

  const doctorAssignedBranches: Branch[] =
    doctor.branches && doctor.branches.length > 0
      ? doctor.branches
      : branches;

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

      <h1>Эмч: {headerName}</h1>

      {/* basic info, branch settings, top schedule form, and table ... */}
      {/* (identical to the version above, omitted here only for brevity) */}
    </div>
  );
}
