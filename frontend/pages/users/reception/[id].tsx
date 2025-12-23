import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type Branch = { id: number; name: string };

type ReceptionUser = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  branchId?: number | null;
  branch?: Branch | null;
  branches?: Branch[];
  regNo?: string | null;
  phone?: string | null;
};

type ReceptionScheduleDay = {
  id: number;
  date: string; // YYYY-MM-DD
  branch: Branch;
  startTime: string;
  endTime: string;
  note?: string | null;
};

export default function ReceptionProfilePage() {
  const router = useRouter();
  const idParam = router.query.id;
  const receptionistId =
    typeof idParam === "string" ? Number(idParam) : NaN;

  const [user, setUser] = useState<ReceptionUser | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [schedule, setSchedule] = useState<ReceptionScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // form state similar to doctor profile (edit name/ovog/phone/etc.)
  // schedule form state similar to doctor schedule

  useEffect(() => {
    if (!receptionistId || Number.isNaN(receptionistId)) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [userRes, branchesRes, scheduleRes] = await Promise.all([
          fetch(`/api/users/${receptionistId}`),
          fetch("/api/branches"),
          fetch(`/api/users/${receptionistId}/reception-schedule`),
        ]);

        const [userData, branchesData, scheduleData] = await Promise.all([
          userRes.json().catch(() => null),
          branchesRes.json().catch(() => []),
          scheduleRes.json().catch(() => []),
        ]);

        if (!userRes.ok || !userData || !userData.id) {
          throw new Error(
            (userData && userData.error) || "Ресепшн хэрэглэгч олдсонгүй"
          );
        }

        setUser(userData);
        setBranches(Array.isArray(branchesData) ? branchesData : []);
        setSchedule(
          Array.isArray(scheduleData) ? scheduleData : []
        );
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Ачаалах үед алдаа гарлаа");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [receptionistId]);

  // Handlers:
  // - handleSave basic profile via PUT /api/users/:id
  // - handleSaveBranches via PUT /api/users/:id/branches
  // - handleSaveSchedule via POST /api/users/:id/reception-schedule
  // - handleDeleteSchedule via DELETE /api/users/:id/reception-schedule/:scheduleId

  // UI: largely the same as doctor profile page – top section for info,
  // bottom section for per-day schedule entries.

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Ресепшн профайл</h1>
      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}
      {!loading && !error && user && (
        <>
          {/* copy the doctor profile layout, but replace texts and APIs */}
        </>
      )}
    </main>
  );
}
