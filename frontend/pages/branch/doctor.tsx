/**
 * /branch/doctor – Doctor kiosk appointments page
 *
 * After the doctor unlocks with their PIN, this page shows today's ongoing
 * appointments. The doctor can tap an appointment to start/continue encounter.
 */
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";

type KioskDoctor = {
  doctorId: number;
  name: string | null;
  ovog: string | null;
  branchId: number;
};

type Patient = {
  id: number;
  name: string;
  ovog: string | null;
  regNo: string | null;
};

type Appointment = {
  id: number;
  scheduledAt: string;
  status: string;
  patient: Patient | null;
};

function formatPatientName(p: Patient | null): string {
  if (!p) return "Тодорхойгүй";
  const name = p.name || "";
  const ovog = (p.ovog || "").trim();
  if (ovog) return `${ovog.charAt(0).toUpperCase()}. ${name}`;
  return name || p.regNo || String(p.id);
}

function formatDoctorDisplayName(d: KioskDoctor | null): string {
  if (!d) return "";
  const name = (d.name || "").trim();
  const ovog = (d.ovog || "").trim();
  if (ovog && name) return `${ovog.charAt(0).toUpperCase()}. ${name}`;
  if (name) return name;
  return "Эмч";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getUTCHours().toString().padStart(2, "0");
    const m = d.getUTCMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return iso;
  }
}

export default function BranchDoctorPage() {
  const router = useRouter();

  const [doctor, setDoctor] = useState<KioskDoctor | null>(null);
  const [authError, setAuthError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [apptError, setApptError] = useState("");

  const [startingEncounter, setStartingEncounter] = useState<number | null>(null);
  const [encounterError, setEncounterError] = useState("");

  // Verify doctor_kiosk session
  useEffect(() => {
    fetch("/api/branch/doctor/me", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          router.replace("/branch");
          return;
        }
        const data = await res.json();
        setDoctor(data as KioskDoctor);
        setAuthChecked(true);
      })
      .catch(() => {
        router.replace("/branch");
      });
  }, [router]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setApptError("");
    try {
      const res = await fetch("/api/branch/doctor/appointments/ongoing", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/branch");
          return;
        }
        throw new Error((data as any)?.error || "Цагийн мэдээллийг ачаалж чадсангүй");
      }
      setAppointments((data as any).appointments ?? []);
    } catch (e: any) {
      setApptError(e?.message || "Сүлжээний алдаа");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authChecked) {
      loadAppointments();
    }
  }, [authChecked, loadAppointments]);

  async function handleStartEncounter(appointmentId: number) {
    setStartingEncounter(appointmentId);
    setEncounterError("");
    try {
      const res = await fetch(`/api/branch/appointments/${appointmentId}/encounter`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Үзлэг нээж чадсангүй");
      }
      const encounterId = (data as any).encounterId;
      router.push(`/encounters/${encounterId}?appointmentId=${appointmentId}`);
    } catch (e: any) {
      setEncounterError(e?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setStartingEncounter(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/branch/doctor/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    router.replace("/branch");
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Ачаалж байна...</div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{authError}</p>
          <button
            type="button"
            onClick={() => router.replace("/branch")}
            className="py-2 px-6 rounded-lg bg-[#131a29] text-white font-semibold text-sm"
          >
            Буцах
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">{formatDoctorDisplayName(doctor)}</p>
          <p className="text-xs text-gray-500">Өнөөдрийн үзлэгүүд</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
        >
          Гарах
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Refresh */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={loadAppointments}
            disabled={loading}
            className="text-sm text-blue-600 underline disabled:opacity-50"
          >
            {loading ? "Ачаалж байна..." : "Шинэчлэх"}
          </button>
        </div>

        {/* Encounter error */}
        {encounterError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {encounterError}
          </div>
        )}

        {/* Appointment list error */}
        {apptError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {apptError}
          </div>
        )}

        {/* Empty state */}
        {!loading && !apptError && appointments.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <p className="text-lg mb-1">Үзлэг байхгүй</p>
            <p className="text-sm">Ресепшн үзлэг идэвхжүүлэхийг хүлээж байна</p>
          </div>
        )}

        {/* Appointments */}
        <div className="flex flex-col gap-3">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold text-gray-800 text-sm">
                  {formatPatientName(appt.patient)}
                </p>
                {appt.patient?.regNo && (
                  <p className="text-xs text-gray-500">{appt.patient.regNo}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{formatTime(appt.scheduledAt)}</p>
              </div>
              <button
                type="button"
                disabled={startingEncounter === appt.id}
                onClick={() => handleStartEncounter(appt.id)}
                className="py-2 px-4 rounded-lg bg-[#131a29] text-white font-semibold text-sm disabled:opacity-50 shrink-0"
              >
                {startingEncounter === appt.id ? "..." : "Үзлэг"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
