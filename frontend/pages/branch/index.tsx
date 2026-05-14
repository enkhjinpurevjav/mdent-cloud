/**
 * /branch – Branch kiosk landing page
 *
 * Displays today's scheduled doctors for the branch.
 * Clicking a doctor card prompts for a 4-digit PIN.
 * On successful unlock, navigates to /branch/doctor.
 */
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { getMe } from "../../utils/auth";
import StaffAvatar from "../../components/StaffAvatar";
import { toAbsoluteFileUrl } from "../../utils/toAbsoluteFileUrl";

type Doctor = {
  id: number;
  name: string | null;
  ovog: string | null;
  idPhotoPath: string | null;
  hasPin: boolean;
};

function formatDoctorName(d: Doctor): string {
  const name = (d.name || "").trim();
  const ovog = (d.ovog || "").trim();
  if (ovog && name) return `${ovog.charAt(0).toUpperCase()}. ${name}`;
  if (name) return name;
  return "Эмч";
}

export default function BranchKioskPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorsError, setDoctorsError] = useState("");

  // PIN modal state
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  // Check authentication
  useEffect(() => {
    getMe().then((user) => {
      if (!user) {
        router.replace("/login?redirect=/branch");
        return;
      }
      if (user.role !== "branch_kiosk") {
        // Non-kiosk users get redirected to their home
        router.replace("/");
        return;
      }
      setIsKiosk(true);
      setAuthChecked(true);
    }).catch(() => {
      router.replace("/login?redirect=/branch");
    });
  }, [router]);

  const loadDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    setDoctorsError("");
    try {
      const res = await fetch("/api/branch/doctors/today", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Эмчийн мэдээллийг ачаалж чадсангүй");
      }
      setDoctors((data as any).doctors ?? []);
    } catch (e: any) {
      setDoctorsError(e?.message || "Сүлжээний алдаа");
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && isKiosk) {
      loadDoctors();
    }
  }, [authChecked, isKiosk, loadDoctors]);

  function openPinModal(doctor: Doctor) {
    setSelectedDoctor(doctor);
    setPin("");
    setUnlockError("");
  }

  function closePinModal() {
    setSelectedDoctor(null);
    setPin("");
    setUnlockError("");
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDoctor) return;
    if (!/^\d{4}$/.test(pin)) {
      setUnlockError("4 оронтой тоо оруулна уу.");
      return;
    }
    setUnlocking(true);
    setUnlockError("");
    try {
      const res = await fetch(`/api/branch/doctors/${selectedDoctor.id}/unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "PIN буруу байна.");
      }
      // Success — navigate to doctor appointments page
      router.push("/branch/doctor");
    } catch (e: any) {
      setUnlockError(e?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setUnlocking(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    router.replace("/login?redirect=/branch");
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Ачаалж байна...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Өнөөдрийн эмч нар</h1>
          <p className="text-gray-500 text-sm mt-1">Эмч дээрээ дарж PIN кодоо оруулна уу</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
        >
          Гарах
        </button>
      </div>

      {/* Refresh button */}
      <div className="max-w-2xl mx-auto mb-4 flex justify-end">
        <button
          type="button"
          onClick={loadDoctors}
          disabled={loadingDoctors}
          className="text-sm text-blue-600 underline disabled:opacity-50"
        >
          {loadingDoctors ? "Ачаалж байна..." : "Шинэчлэх"}
        </button>
      </div>

      {/* Error state */}
      {doctorsError && (
        <div className="max-w-2xl mx-auto mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {doctorsError}
        </div>
      )}

      {/* Doctors grid */}
      {!loadingDoctors && !doctorsError && doctors.length === 0 && (
        <div className="max-w-2xl mx-auto text-center text-gray-500 py-12">
          Өнөөдөр цагтай эмч байхгүй байна.
        </div>
      )}

      <div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-4">
        {doctors.map((doctor) => (
          <button
            key={doctor.id}
            type="button"
            onClick={() => openPinModal(doctor)}
            className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all active:scale-95"
          >
            <StaffAvatar
              name={doctor.name}
              ovog={doctor.ovog}
              idPhotoPath={doctor.idPhotoPath ? toAbsoluteFileUrl(doctor.idPhotoPath) : null}
              sizeClassName="w-20 h-20"
            />
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-sm">{formatDoctorName(doctor)}</p>
              {!doctor.hasPin && (
                <p className="text-xs text-amber-500 mt-0.5">PIN тохируулаагүй</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* PIN Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center gap-3 mb-5">
              <StaffAvatar
                name={selectedDoctor.name}
                ovog={selectedDoctor.ovog}
                idPhotoPath={
                  selectedDoctor.idPhotoPath
                    ? toAbsoluteFileUrl(selectedDoctor.idPhotoPath)
                    : null
                }
                sizeClassName="w-16 h-16"
              />
              <h2 className="text-lg font-semibold text-gray-800">
                {formatDoctorName(selectedDoctor)}
              </h2>
              <p className="text-sm text-gray-500">4 оронтой PIN кодоо оруулна уу</p>
            </div>

            <form onSubmit={handleUnlock} className="flex flex-col gap-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(v);
                  setUnlockError("");
                }}
                placeholder="• • • •"
                autoFocus
                className="w-full text-center text-3xl tracking-[0.5em] border border-gray-300 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />

              {unlockError && (
                <p className="text-red-600 text-sm text-center">{unlockError}</p>
              )}

              <button
                type="submit"
                disabled={unlocking || pin.length !== 4}
                className="w-full py-3 rounded-xl bg-[#131a29] text-white font-semibold text-sm disabled:opacity-50"
              >
                {unlocking ? "Нэвтэрч байна..." : "Нэвтрэх"}
              </button>

              <button
                type="button"
                onClick={closePinModal}
                disabled={unlocking}
                className="w-full py-3 rounded-xl border border-gray-300 text-gray-600 font-semibold text-sm disabled:opacity-50"
              >
                Буцах
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
