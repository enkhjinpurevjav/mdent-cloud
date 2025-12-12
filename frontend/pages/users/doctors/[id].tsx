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

  // multiple branches
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

  // selected multiple branches
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  // schedule state
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // schedule editor form state
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

        // Determine if chosen date is weekend; fallback to generic defaults if no date yet
        if (prev.date) {
          const d = new Date(prev.date);
          const day = d.getDay(); // 0=Sun, 6=Sat
          const isWeekend = day === 0 || day === 6;

          if (shift === "AM") {
            updated.startTime = isWeekend ? "10:00" : "09:00";
            updated.endTime = isWeekend ? "14:00" : "15:00";
          } else if (shift === "PM") {
            updated.startTime = isWeekend ? "14:00" : "15:00";
            updated.endTime = isWeekend ? "19:00" : "21:00";
          } else if (shift === "WEEKEND_FULL") {
            updated.startTime = "10:00";
            updated.endTime = "19:00";
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
        branchId: form.branchId ? Number(form.branchId) : null, // legacy single branch
        regNo: form.regNo || null,
        licenseNumber: form.licenseNumber || null,
        licenseExpiryDate: form.licenseExpiryDate || null, // yyyy-mm-dd
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
      // refresh schedule list
      await reloadSchedule();
    } catch (err) {
      console.error(err);
      setScheduleSaveError("Сүлжээгээ шалгана уу");
    } finally {
      setScheduleSaving(false);
      // Clear success after short delay
      setTimeout(() => setScheduleSaveSuccess(null), 3000);
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

  // Only allow selecting branches that this doctor is assigned to
  const doctorAssignedBranches: Branch[] =
    doctor.branches && doctor.branches.length > 0
      ? doctor.branches
      : branches;

  const isEditingSchedule =
    !!scheduleForm.date && !!scheduleForm.branchId;

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
        {/* Doctor ID photo */}
        {doctor.idPhotoPath && (
          <div
            style={{
              marginBottom: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontWeight: 500 }}>Иргэний үнэмлэхийн зураг</span>
            <img
              src={doctor.idPhotoPath}
              alt="Эмчийн ID зураг"
              style={{
                width: 160,
                height: 200,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            />
          </div>
        )}
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
          РД (regNo)
          <input
            name="regNo"
            value={form.regNo}
            onChange={handleChange}
            placeholder="РД"
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

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 8,
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

        {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      </form>

      {/* Multi-branch assignment section */}
      <section style={{ marginTop: 32, maxWidth: 500 }}>
        <h2>Салбарын тохиргоо</h2>
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

      {/* Schedule editor form */}
      <section style={{ marginTop: 32, maxWidth: 600 }}>
        <h2>
          {isEditingSchedule
            ? "Ажлын хуваарь засах"
            : "Ажлын хуваарь нэмэх"}
        </h2>
        <p style={{ color: "#555", marginBottom: 8 }}>
          Сонгосон өдөр, салбар, ээлжийн дагуу ажлын хуваарь үүсгэнэ эсвэл
          засна.
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
            disabled={scheduleSaving}
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
            {scheduleSaving
              ? "Хуваарь хадгалж байна..."
              : isEditingSchedule
              ? "Засвар хадгалах"
              : "Хуваарь хадгалах"}
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

      {/* Work schedule (next 31 days) */}
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
              {schedule.map((s) => (
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
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        // load row into form
                        setScheduleForm((prev) => ({
                          ...prev,
                          date: s.date, // "YYYY-MM-DD"
                          branchId: String(s.branch?.id ?? ""),
                          startTime: s.startTime,
                          endTime: s.endTime,
                          note: s.note || "",
                          // keep current shiftType; or you can recompute if you want
                        }));
                        // optionally scroll to form
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
