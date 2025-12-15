import React, { useEffect, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  name: string | null;
  ovog: string | null;
};

type ScheduledDoctor = Doctor & {
  schedules?: {
    id: number;
    branchId: number;
    date: string;
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
    note: string | null;
  }[];
};

type PatientLite = {
  id: number;
  name: string;
  ovog?: string | null;
  regNo: string;
  phone?: string | null;
  patientBook?: { bookNumber: string } | null;
};

type Appointment = {
  id: number;
  patientId: number;
  doctorId: number | null;
  branchId: number;
  scheduledAt: string;
  status: string;
  notes: string | null;
  patient?: PatientLite;
  doctor?: Doctor | null;
  branch?: Branch | null;
};

function groupByDate(appointments: Appointment[]) {
  const map: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    const d = new Date(a.scheduledAt);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!map[day]) map[day] = [];
    map[day].push(a);
  }
  const entries = Object.entries(map).sort(([d1], [d2]) =>
    d1 < d2 ? -1 : d1 > d2 ? 1 : 0
  );
  return entries;
}

// Default weekday hours
const START_HOUR = 9; // 09:00
const END_HOUR = 21; // 21:00
const SLOT_MINUTES = 30;

// Weekend clinic hours
const WEEKEND_START_HOUR = 10; // 10:00
const WEEKEND_END_HOUR = 19; // 19:00

type TimeSlot = {
  label: string; // "09:00"
  start: Date;
  end: Date;
};

function generateTimeSlotsForDay(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const weekdayIndex = day.getDay(); // 0=Sun, 6=Sat
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  const startHour = isWeekend ? WEEKEND_START_HOUR : START_HOUR;
  const endHour = isWeekend ? WEEKEND_END_HOUR : END_HOUR;

  for (let hour = startHour; hour < endHour; hour++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const start = new Date(day);
      start.setHours(hour, m, 0, 0);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
      const label = start.toLocaleTimeString("mn-MN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      slots.push({ label, start, end });
    }
  }
  return slots;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function getSlotTimeString(date: Date): string {
  // "HH:MM" in local time
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isTimeWithinRange(time: string, startTime: string, endTime: string) {
  // inclusive of start, exclusive of end
  return time >= startTime && time < endTime;
}

function formatDoctorName(d?: Doctor | null) {
  if (!d) return "Тодорхойгүй";
  const name = d.name || "";
  const ovog = (d.ovog || "").trim();
  if (name && ovog) {
    return `${ovog.charAt(0).toUpperCase()}.${name}`;
  }
  return name || "Тодорхойгүй";
}

function formatPatientLabel(p?: PatientLite, id?: number) {
  if (!p) return `Patient #${id ?? "-"}`;
  const book = p.patientBook?.bookNumber
    ? ` • Карт: ${p.patientBook.bookNumber}`
    : "";
  return `${p.name}${book}`;
}

function formatPatientSearchLabel(p: PatientLite): string {
  const ovog = (p.ovog || "").trim();
  const name = (p.name || "").trim();
  const phone = (p.phone || "").trim();
  const regNo = (p.regNo || "").trim();
  const parts: string[] = [];

  if (ovog || name) {
    parts.push([ovog, name].filter(Boolean).join(" "));
  }
  if (phone) {
    parts.push(`Утас: ${phone}`);
  }
  if (regNo) {
    parts.push(`РД: ${regNo}`);
  }
  if (p.patientBook?.bookNumber) {
    parts.push(`Карт #${p.patientBook.bookNumber}`);
  }

  return parts.join(" • ");
}

function getDateFromYMD(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

type AppointmentFormProps = {
  branches: Branch[];
  doctors: Doctor[];
  scheduledDoctors: ScheduledDoctor[];
  appointments: Appointment[];
  selectedDate: string;
  selectedBranchId: string;
  onCreated: (a: Appointment) => void;
};

function AppointmentForm({
  branches,
  doctors,
  scheduledDoctors,
  appointments,
  selectedDate,
  selectedBranchId,
  onCreated,
}: AppointmentFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [form, setForm] = useState({
    patientQuery: "",
    doctorId: "",
    branchId: branches.length ? String(branches[0].id) : "",
    date: selectedDate || todayStr,
    time: "",
    status: "booked",
    notes: "",
  });
  const [error, setError] = useState("");

  // visible patient search results
  const [patientResults, setPatientResults] = useState<PatientLite[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    null
  );
  const [searchDebounceTimer, setSearchDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);

  // quick new patient modal
  const [showQuickPatientModal, setShowQuickPatientModal] = useState(false);
  const [quickPatientForm, setQuickPatientForm] = useState<{
    name: string;
    phone: string;
    branchId: string;
  }>({
    name: "",
    phone: "",
    branchId: "",
  });
  const [quickPatientError, setQuickPatientError] = useState("");
  const [quickPatientSaving, setQuickPatientSaving] = useState(false);

  // 30-minute time slots for the currently selected date
  const [daySlots, setDaySlots] = useState<{ label: string; value: string }[]>(
    []
  );

  useEffect(() => {
    if (!form.branchId && branches.length > 0) {
      setForm((prev) => ({ ...prev, branchId: String(branches[0].id) }));
    }
  }, [branches, form.branchId]);

  useEffect(() => {
    if (selectedDate) {
      setForm((prev) => ({ ...prev, date: selectedDate }));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedBranchId) {
      setForm((prev) => ({ ...prev, branchId: selectedBranchId }));
    }
  }, [selectedBranchId]);

  // recompute daySlots whenever date changes
  useEffect(() => {
    if (!form.date) return;
    const [year, month, day] = form.date.split("-").map(Number);
    if (!year || !month || !day) return;
    const d = new Date(year, (month || 1) - 1, day || 1);
    const slots = generateTimeSlotsForDay(d).map((s) => ({
      label: s.label,
      value: getSlotTimeString(s.start),
    }));
    setDaySlots(slots);
  }, [form.date]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === "patientQuery") {
      setSelectedPatientId(null);
      triggerPatientSearch(value);
    }
  };

  // ---- patient search (visible list) ----

  const triggerPatientSearch = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    if (!query) {
      setPatientResults([]);
      return;
    }

    const qAtSchedule = query.toLowerCase();

    const t = setTimeout(async () => {
      try {
        setPatientSearchLoading(true);

        const url = `/api/patients?query=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          setPatientResults([]);
          return;
        }

        const rawList = Array.isArray(data)
          ? data
          : Array.isArray((data as any).patients)
          ? (data as any).patients
          : [];

        const isNumeric = /^[0-9]+$/.test(qAtSchedule);

        const filtered = rawList.filter((p: any) => {
          const regNo = (p.regNo ?? p.regno ?? "")
            .toString()
            .toLowerCase();
          const phone = (p.phone ?? "").toString().toLowerCase();
          const name = (p.name ?? "").toString().toLowerCase();
          const ovog = (p.ovog ?? "").toString().toLowerCase();
          const bookNumber = (p.patientBook?.bookNumber ?? "")
            .toString()
            .toLowerCase();

          if (isNumeric) {
            return (
              regNo.includes(qAtSchedule) ||
              phone.includes(qAtSchedule) ||
              bookNumber.includes(qAtSchedule)
            );
          }

          return (
            regNo.includes(qAtSchedule) ||
            phone.includes(qAtSchedule) ||
            name.includes(qAtSchedule) ||
            ovog.includes(qAtSchedule) ||
            bookNumber.includes(qAtSchedule)
          );
        });

        setPatientResults(
          filtered.map((p: any) => ({
            id: p.id,
            name: p.name,
            ovog: p.ovog ?? null,
            regNo: p.regNo ?? p.regno ?? "",
            phone: p.phone,
            patientBook: p.patientBook || null,
          }))
        );
      } catch (e) {
        console.error("patient search failed", e);
        setPatientResults([]);
      } finally {
        setPatientSearchLoading(false);
      }
    }, 300);

    setSearchDebounceTimer(t);
  };

  const handleSelectPatient = (p: PatientLite) => {
    setSelectedPatientId(p.id);
    setForm((prev) => ({
      ...prev,
      patientQuery: formatPatientSearchLabel(p),
    }));
    setPatientResults([]);
    setError("");
  };

  // ---- schedule-aware validation ----

  const getDoctorSchedulesForDate = () => {
    if (!form.doctorId) return [];
    const doctorIdNum = Number(form.doctorId);
    const doc = scheduledDoctors.find((d) => d.id === doctorIdNum);
    if (!doc || !doc.schedules) return [];
    return doc.schedules;
  };

  const isWithinDoctorSchedule = (scheduledAt: Date) => {
    const schedules = getDoctorSchedulesForDate();
    if (schedules.length === 0) return true;
    const timeStr = getSlotTimeString(scheduledAt);
    return schedules.some((s: any) =>
      isTimeWithinRange(timeStr, s.startTime, s.endTime)
    );
  };

  const countAppointmentsInSlot = (scheduledAt: Date) => {
    if (!form.doctorId) return 0;
    const doctorIdNum = Number(form.doctorId);

    const slotStart = new Date(scheduledAt);
    const slotEnd = new Date(
      slotStart.getTime() + SLOT_MINUTES * 60 * 1000
    );

    return appointments.filter((a) => {
      if (a.doctorId !== doctorIdNum) return false;
      if (selectedBranchId && String(a.branchId) !== selectedBranchId)
        return false;
      const t = new Date(a.scheduledAt);
      if (Number.isNaN(t.getTime())) return false;
      const dayStr = t.toISOString().slice(0, 10);
      if (dayStr !== form.date) return false;
      return t >= slotStart && t < slotEnd;
    }).length;
  };

  // ---- quick new patient (modal) ----

  const handleQuickPatientChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setQuickPatientForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickPatientSave = async () => {
    setQuickPatientError("");

    if (!quickPatientForm.name.trim() || !quickPatientForm.phone.trim()) {
      setQuickPatientError("Нэр болон утас заавал бөглөнө үү.");
      return;
    }

    const branchIdFromModal = quickPatientForm.branchId
      ? Number(quickPatientForm.branchId)
      : null;
    const branchIdFromForm = form.branchId
      ? Number(form.branchId)
      : selectedBranchId
      ? Number(selectedBranchId)
      : null;

    const branchIdForPatient = !Number.isNaN(branchIdFromModal ?? NaN)
      ? branchIdFromModal
      : branchIdFromForm;

    if (!branchIdForPatient || Number.isNaN(branchIdForPatient)) {
      setQuickPatientError(
        "Шинэ үйлчлүүлэгч бүртгэхийн өмнө салбар сонгоно уу."
      );
      return;
    }

    setQuickPatientSaving(true);

    try {
      const payload: any = {
        name: quickPatientForm.name.trim(),
        phone: quickPatientForm.phone.trim(),
        branchId: branchIdForPatient,
      };

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || typeof data.id !== "number") {
        setQuickPatientError(
          (data && (data as any).error) ||
            "Шинэ үйлчлүүлэгч бүртгэх үед алдаа гарлаа."
        );
        setQuickPatientSaving(false);
        return;
      }

      const p: PatientLite = {
        id: data.id,
        name: data.name,
        ovog: data.ovog ?? null,
        regNo: data.regNo ?? "",
        phone: data.phone ?? null,
        patientBook: data.patientBook || null,
      };

      setSelectedPatientId(p.id);
      setForm((prev) => ({
        ...prev,
        patientQuery: formatPatientSearchLabel(p),
      }));

      setQuickPatientForm({ name: "", phone: "", branchId: "" });
      setShowQuickPatientModal(false);
    } catch (e) {
      console.error(e);
      setQuickPatientError("Сүлжээгээ шалгана уу.");
    } finally {
      setQuickPatientSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.branchId || !form.date || !form.time) {
      setError("Салбар, огноо, цаг талбаруудыг бөглөнө үү.");
      return;
    }

    if (!selectedPatientId) {
      setError(
        "Үйлчлүүлэгчийг жагсаалтаас сонгох эсвэл + товчоор шинээр бүртгэнэ үү."
      );
      return;
    }

    // doctor is REQUIRED now
    if (!form.doctorId) {
      setError("Цаг захиалахын өмнө эмчийг заавал сонгоно уу.");
      return;
    }

    const [year, month, day] = form.date.split("-").map(Number);
    const [hour, minute] = form.time.split(":").map(Number);

    const local = new Date(
      year,
      (month || 1) - 1,
      day || 1,
      hour || 0,
      minute || 0,
      0,
      0
    );

    if (Number.isNaN(local.getTime())) {
      setError("Огноо/цаг буруу байна.");
      return;
    }

    const scheduledAtStr = local.toISOString();
    const scheduledAt = local;

    const patientId = selectedPatientId;

    // since doctor is required, always validate schedule & capacity
    if (!isWithinDoctorSchedule(scheduledAt)) {
      setError("Сонгосон цагт эмчийн ажлын хуваарь байхгүй байна.");
      return;
    }

    const existingCount = countAppointmentsInSlot(scheduledAt);
    if (existingCount >= 2) {
      setError("Энэ 30 минутын блок дээр аль хэдийн 2 захиалга байна.");
      return;
    }

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          doctorId: Number(form.doctorId),
          branchId: Number(form.branchId),
          scheduledAt: scheduledAtStr,
          status: form.status,
          notes: form.notes || null,
        }),
      });
      let data: Appointment | { error?: string };
      try {
        data = await res.json();
      } catch {
        data = { error: "Unknown error" };
      }
      if (res.ok) {
        onCreated(data as Appointment);
        setForm((prev) => ({
          ...prev,
          patientQuery: "",
          time: "",
          notes: "",
          status: "booked",
          doctorId: "",
        }));
        setSelectedPatientId(null);
        setPatientResults([]);
      } else {
        setError((data as any).error || "Алдаа гарлаа");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    }
  };

  // only show doctors who are scheduled for this date/branch
  const availableDoctors = scheduledDoctors.length
    ? doctors.filter((d) => scheduledDoctors.some((s) => s.id === d.id))
    : doctors;

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: 24,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        fontSize: 13,
      }}
    >
      {/* Үйлчлүүлэгч */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          gridColumn: "1 / -1",
        }}
      >
        <label>Үйлчлүүлэгч</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            name="patientQuery"
            placeholder="РД, овог, нэр эсвэл утас..."
            value={form.patientQuery}
            onChange={handleChange}
            style={{
              flex: 1,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />
          <button
            type="button"
            onClick={() => {
              setShowQuickPatientModal(true);
              setQuickPatientError("");
              setQuickPatientForm((prev) => ({
                ...prev,
                branchId: prev.branchId || form.branchId || selectedBranchId,
              }));
            }}
            style={{
              padding: "0 10px",
              borderRadius: 6,
              border: "1px солид #16a34a",
              background: "#dcfce7",
              color: "#166534",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Шинэ үйлчлүүлэгч хурдан бүртгэх"
          >
            +
          </button>
        </div>
        {patientSearchLoading && (
          <span style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            Үйлчлүүлэгч хайж байна...
          </span>
        )}
      </div>

      {patientResults.length > 0 && (
        <div
          style={{
            gridColumn: "1 / -1",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {patientResults.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPatient(p)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                border: "none",
                borderBottom: "1px solid #f3f4f6",
                background: "white",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {formatPatientSearchLabel(p)}
            </button>
          ))}
        </div>
      )}

      {/* Doctor – only scheduled doctors */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Эмч (заавал)</label>
        <select
          name="doctorId"
          value={form.doctorId}
          onChange={(e) => {
            handleChange(e);
            setError("");
          }}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Ажиллах эмч сонгох</option>
          {availableDoctors.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDoctorName(d)}
            </option>
          ))}
        </select>
        {scheduledDoctors.length === 0 && (
          <span style={{ fontSize: 11, color: "#b91c1c", marginTop: 2 }}>
            Энэ өдөр сонгосон салбарт эмчийн ажлын хуваарь олдсонгүй.
          </span>
        )}
      </div>

      {/* Branch */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Салбар</label>
        <select
          name="branchId"
          value={form.branchId}
          onChange={handleChange}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Салбар сонгох</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Огноо</label>
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      {/* Time – 30 минутын слот */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Цаг</label>
        <select
          name="time"
          value={form.time}
          onChange={(e) => {
            handleChange(e);
            setError("");
          }}
          required
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="">Цаг сонгох</option>
          {daySlots.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label>Төлөв</label>
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        >
          <option value="booked">Захиалсан</option>
          <option value="ongoing">Явагдаж байна</option>
          <option value="completed">Дууссан</option>
          <option value="cancelled">Цуцлагдсан</option>
        </select>
      </div>

      {/* Notes */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          gridColumn: "1 / -1",
        }}
      >
        <label>Тэмдэглэл</label>
        <input
          name="notes"
          placeholder="Ж: Эмчилгээний товч тэмдэглэл"
          value={form.notes}
          onChange={handleChange}
          style={{
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
          }}
        />
      </div>

      {/* Submit + error */}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Цаг захиалах
        </button>
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 12, alignSelf: "center" }}>
            {error}
          </div>
        )}
      </div>

      {/* Quick new patient modal */}
      {showQuickPatientModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 16,
              width: 340,
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              fontSize: 13,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
              Шинэ үйлчлүүлэгч хурдан бүртгэх
            </h3>
            <p
              style={{
                marginTop: 0,
                marginBottom: 12,
                color: "#6b7280",
              }}
            >
              Зөвхөн нэр, утас болон салбарыг бүртгэнэ. Дэлгэрэнгүй мэдээллийг
              дараа нь &quot;Үйлчлүүлэгчийн бүртгэл&quot; хэсгээс засварлана.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Нэр
                <input
                  name="name"
                  value={quickPatientForm.name}
                  onChange={handleQuickPatientChange}
                  placeholder="Ж: Батболд"
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Утас
                <input
                  name="phone"
                  value={quickPatientForm.phone}
                  onChange={handleQuickPatientChange}
                  placeholder="Ж: 99112233"
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Салбар
                <select
                  name="branchId"
                  value={quickPatientForm.branchId}
                  onChange={handleQuickPatientChange}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                >
                  <option value="">Сонгох</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              {quickPatientError && (
                <div
                  style={{
                    color: "#b91c1c",
                    fontSize: 12,
                  }}
                >
                  {quickPatientError}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!quickPatientSaving) {
                      setShowQuickPatientModal(false);
                      setQuickPatientError("");
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#f9fafb",
                    cursor: quickPatientSaving ? "default" : "pointer",
                  }}
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleQuickPatientSave}
                  disabled={quickPatientSaving}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    cursor: quickPatientSaving ? "default" : "pointer",
                  }}
                >
                  {quickPatientSaving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [scheduledDoctors, setScheduledDoctors] = useState<ScheduledDoctor[]>(
    []
  );
  const [error, setError] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterBranchId, setFilterBranchId] = useState<string>("");
  const [filterDoctorId, setFilterDoctorId] = useState<string>("");

  const [activeBranchTab, setActiveBranchTab] = useState<string>("");

  const groupedAppointments = groupByDate(appointments);
  const selectedDay = getDateFromYMD(filterDate);
  const timeSlots = generateTimeSlotsForDay(selectedDay);

  const loadAppointments = async () => {
    try {
      setError("");
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);
      if (filterDoctorId) params.set("doctorId", filterDoctorId);

      const res = await fetch(`/api/appointments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        throw new Error("failed");
      }
      setAppointments(data);
    } catch {
      setError("Цаг захиалгуудыг ачаалах үед алдаа гарлаа.");
    }
  };

  const loadScheduledDoctors = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (filterBranchId) params.set("branchId", filterBranchId);

      const res = await fetch(`/api/doctors/scheduled?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        throw new Error("failed");
      }

      const sorted = data
        .slice()
        .sort((a: ScheduledDoctor, b: ScheduledDoctor) => {
          const an = (a.name || "").toLowerCase();
          const bn = (b.name || "").toLowerCase();
          return an.localeCompare(bn);
        });

      setScheduledDoctors(sorted);
    } catch (e) {
      console.error("Failed to load scheduled doctors", e);
      setScheduledDoctors([]);
    }
  };

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch("/api/branches"),
          fetch("/api/users?role=doctor"),
        ]);

        const [bData, dData] = await Promise.all([
          bRes.json().catch(() => []),
          dRes.json().catch(() => []),
        ]);

        if (Array.isArray(bData)) setBranches(bData);
        if (Array.isArray(dData)) setDoctors(dData);
      } catch (e) {
        console.error(e);
      }
    };

    loadMeta();
  }, []);

  useEffect(() => {
    loadAppointments();
    loadScheduledDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, filterBranchId, filterDoctorId]);

  const handleBranchTabClick = (branchId: string) => {
    setActiveBranchTab(branchId);
    setFilterBranchId(branchId);
  };

  const gridDoctors: ScheduledDoctor[] = scheduledDoctors;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Цаг захиалга</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Өвчтөн, эмч, салбарын цаг захиалгуудыг харах, нэмэх, удирдах.
      </p>

      {/* Branch view tabs */}
      <section
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => handleBranchTabClick("")}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid transparent",
            backgroundColor: activeBranchTab === "" ? "#2563eb" : "transparent",
            color: activeBranchTab === "" ? "#ffffff" : "#374151",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Бүх салбар
        </button>
        {branches.map((b) => {
          const idStr = String(b.id);
          const isActive = activeBranchTab === idStr;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBranchTabClick(idStr)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: isActive ? "1px solid #2563eb" : "1px solid #d1d5db",
                backgroundColor: isActive ? "#eff6ff" : "#ffffff",
                color: isActive ? "#1d4ed8" : "#374151",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {b.name}
            </button>
          );
        })}
      </section>

      {/* Filters card */}
      <section
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontSize: 13,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
          Шүүлтүүр
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Огноо</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Салбар</label>
            <select
              value={filterBranchId}
              onChange={(e) => {
                const value = e.target.value;
                setFilterBranchId(value);
                setActiveBranchTab(value);
              }}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Бүх салбар</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Эмч</label>
            <select
              value={filterDoctorId}
              onChange={(e) => setFilterDoctorId(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Бүх эмч</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDoctorName(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Create form card */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "white",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>
          Шинэ цаг захиалах
        </h2>
        <AppointmentForm
          branches={branches}
          doctors={doctors}
          scheduledDoctors={scheduledDoctors}
          appointments={appointments}
          selectedDate={filterDate}
          selectedBranchId={filterBranchId}
          onCreated={(a) => setAppointments((prev) => [a, ...prev])}
        />
      </section>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Day-grouped mini calendar */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Календарь (өдрөөр)</h2>
        {groupedAppointments.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Цаг захиалга алга.
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 16,
            overflowX: "auto",
            paddingBottom: 8,
            justifyContent: "flex-start",
          }}
        >
          {groupedAppointments.map(([date, apps]) => (
            <div
              key={date}
              style={{
                minWidth: 260,
                maxWidth: 320,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
                backgroundColor: "#ffffff",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 8,
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {new Date(date).toLocaleDateString("mn-MN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                })}
              </div>
              {apps
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.scheduledAt).getTime() -
                    new Date(b.scheduledAt).getTime()
                )
                .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      marginBottom: 6,
                      padding: 6,
                      borderRadius: 4,
                      backgroundColor:
                        a.status === "completed"
                          ? "#e0f7e9"
                          : a.status === "ongoing"
                          ? "#fff4e0"
                          : a.status === "cancelled"
                          ? "#fde0e0"
                          : "#e6f0ff",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {new Date(a.scheduledAt).toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      — {formatPatientLabel(a.patient, a.patientId)}
                    </div>
                    <div>
                      Эмч: {formatDoctorName(a.doctor)} | Салбар:{" "}
                      {a.branch?.name ?? a.branchId}
                    </div>
                    <div>Тайлбар: {a.notes || "-"}</div>
                    <div>Төлөв: {a.status}</div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* Time grid by doctor */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>
          Өдрийн цагийн хүснэгт (эмчээр)
        </h2>
        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
          {selectedDay.toLocaleDateString("mn-MN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            weekday: "long",
          })}
        </div>
        {gridDoctors.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Энэ өдөр ажиллах эмчийн хуваарь алга.
          </div>
        )}
        {gridDoctors.length > 0 && (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
              fontSize: 12,
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
                backgroundColor: "#f5f5f5",
                borderBottom: "1px solid #ddd",
              }}
            >
              <div style={{ padding: 8, fontWeight: "bold" }}>Цаг</div>
              {gridDoctors.map((doc) => {
                const count = appointments.filter(
                  (a) => a.doctorId === doc.id
                ).length;
                return (
                  <div
                    key={doc.id}
                    style={{
                      padding: 8,
                      fontWeight: "bold",
                      textAlign: "center",
                      borderLeft: "1px solid #ddd",
                    }}
                  >
                    <div>{formatDoctorName(doc)}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        marginTop: 2,
                      }}
                    >
                      {count} захиалга
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time rows */}
            <div>
              {timeSlots.map((slot, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${gridDoctors.length}, 1fr)`,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {/* Time label */}
                  <div
                    style={{
                      padding: 6,
                      borderRight: "1px solid #ddd",
                      backgroundColor:
                        rowIndex % 2 === 0 ? "#fafafa" : "#ffffff",
                    }}
                  >
                    {slot.label}
                  </div>

                  {/* Cell per doctor */}
                  {gridDoctors.map((doc) => {
                    const appsForCell = appointments.filter((a) => {
                      if (a.doctorId !== doc.id) return false;
                      const t = new Date(a.scheduledAt);
                      if (Number.isNaN(t.getTime())) return false;
                      return t >= slot.start && t < slot.end;
                    });

                    const slotTimeStr = getSlotTimeString(slot.start);
                    const schedules = (doc as any).schedules || [];

                    const isWorkingHour = schedules.some((s: any) =>
                      isTimeWithinRange(
                        slotTimeStr,
                        s.startTime,
                        s.endTime
                      )
                    );

                    const weekdayIndex = slot.start.getDay();
                    const isWeekend =
                      weekdayIndex === 0 || weekdayIndex === 6;

                    const isWeekendLunch =
                      isWeekend &&
                      isTimeWithinRange(slotTimeStr, "14:00", "15:00");

                    let bg: string;

                    if (!isWorkingHour || isWeekendLunch) {
                      bg = "#ee7148";
                    } else if (appsForCell.length === 0) {
                      bg = "#ffffff";
                    } else {
                      const status = appsForCell[0].status;
                      bg =
                        status === "completed"
                          ? "#e0f7e9"
                          : status === "ongoing"
                          ? "#fff4e0"
                          : status === "cancelled"
                          ? "#fde0e0"
                          : "#e6f0ff";
                    }

                    return (
                      <div
                        key={doc.id}
                        style={{
                          padding: 4,
                          borderLeft: "1px solid #f0f0f0",
                          backgroundColor: bg,
                          minHeight: 28,
                        }}
                      >
                        {appsForCell.map((a) => (
                          <div key={a.id}>
                            {formatPatientLabel(a.patient, a.patientId)} (
                            {a.status})
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Raw table */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>
          Бүгдийг жагсаалтаар харах
        </h2>
        {appointments.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Цаг захиалга алга.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 4,
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Өвчтөн
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Салбар
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Эмч
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Огноо / цаг
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Төлөв
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 6,
                  }}
                >
                  Тэмдэглэл
                </th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.id}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {formatPatientLabel(a.patient, a.patientId)}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.branch?.name ?? a.branchId}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {formatDoctorName(a.doctor ?? null)}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {new Date(a.scheduledAt).toLocaleString("mn-MN")}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.status}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 6,
                    }}
                  >
                    {a.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
