import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import StaffAvatar from "../../components/StaffAvatar";
import { toAbsoluteFileUrl } from "../../utils/toAbsoluteFileUrl";
import { getMe } from "../../utils/auth";

type Nurse = {
  id: number;
  name: string | null;
  ovog: string | null;
  idPhotoPath: string | null;
  hasPin: boolean;
};

function formatNurseName(n: Nurse): string {
  const name = (n.name || "").trim();
  const ovog = (n.ovog || "").trim();
  if (ovog && name) return `${ovog.charAt(0).toUpperCase()}. ${name}`;
  if (name) return name;
  return "Сувилагч";
}

export default function BranchNurseKioskPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loadingNurses, setLoadingNurses] = useState(false);
  const [nursesError, setNursesError] = useState("");

  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user) {
          router.replace("/login?redirect=/branch-nurse");
          return;
        }
        if (user.role !== "branch_nurse_kiosk") {
          router.replace("/");
          return;
        }
        setIsKiosk(true);
        setAuthChecked(true);
      })
      .catch(() => {
        router.replace("/login?redirect=/branch-nurse");
      });
  }, [router]);

  const loadNurses = useCallback(async () => {
    setLoadingNurses(true);
    setNursesError("");
    try {
      const res = await fetch("/api/branch/nurses/all", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Сувилагчийн мэдээллийг ачаалж чадсангүй");
      }
      setNurses((data as any).nurses ?? []);
    } catch (e: any) {
      setNursesError(e?.message || "Сүлжээний алдаа");
    } finally {
      setLoadingNurses(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && isKiosk) {
      void loadNurses();
    }
  }, [authChecked, isKiosk, loadNurses]);

  function openPinModal(nurse: Nurse) {
    setSelectedNurse(nurse);
    setPin("");
    setUnlockError("");
  }

  function closePinModal() {
    setSelectedNurse(null);
    setPin("");
    setUnlockError("");
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNurse) return;
    if (!/^\d{4}$/.test(pin)) {
      setUnlockError("4 оронтой тоо оруулна уу.");
      return;
    }
    setUnlocking(true);
    setUnlockError("");
    try {
      const res = await fetch(`/api/branch/nurses/${selectedNurse.id}/unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "PIN буруу байна.");
      }
      router.push("/branch-nurse/returns");
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
    window.location.href = "/login?redirect=/branch-nurse";
  }

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Ачаалж байна...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto mb-8 flex max-w-2xl items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Сувилагч киоск</h1>
          <p className="mt-1 text-sm text-gray-500">Сувилагч дээр дарж PIN кодоо оруулна уу</p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
        >
          Гарах
        </button>
      </div>

      <div className="mx-auto mb-4 flex max-w-2xl justify-end">
        <button
          type="button"
          onClick={() => void loadNurses()}
          disabled={loadingNurses}
          className="text-sm text-blue-600 underline disabled:opacity-50"
        >
          {loadingNurses ? "Ачаалж байна..." : "Шинэчлэх"}
        </button>
      </div>

      {nursesError && (
        <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {nursesError}
        </div>
      )}

      {!loadingNurses && !nursesError && nurses.length === 0 && (
        <div className="mx-auto max-w-2xl py-12 text-center text-gray-500">
          Сувилагч олдсонгүй.
        </div>
      )}

      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
        {nurses.map((nurse) => (
          <button
            key={nurse.id}
            type="button"
            onClick={() => openPinModal(nurse)}
            className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md active:scale-95"
          >
            <StaffAvatar
              name={nurse.name}
              ovog={nurse.ovog}
              idPhotoPath={nurse.idPhotoPath ? toAbsoluteFileUrl(nurse.idPhotoPath) : null}
              sizeClassName="w-20 h-20"
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">{formatNurseName(nurse)}</p>
              {!nurse.hasPin && <p className="mt-0.5 text-xs text-amber-500">PIN тохируулаагүй</p>}
            </div>
          </button>
        ))}
      </div>

      {selectedNurse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex flex-col items-center gap-3">
              <StaffAvatar
                name={selectedNurse.name}
                ovog={selectedNurse.ovog}
                idPhotoPath={selectedNurse.idPhotoPath ? toAbsoluteFileUrl(selectedNurse.idPhotoPath) : null}
                sizeClassName="w-16 h-16"
              />
              <h2 className="text-lg font-semibold text-gray-800">{formatNurseName(selectedNurse)}</h2>
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-3xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-400"
              />

              {unlockError && <p className="text-center text-sm text-red-600">{unlockError}</p>}

              <button
                type="submit"
                disabled={unlocking || pin.length !== 4}
                className="w-full rounded-xl bg-[#131a29] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {unlocking ? "Нэвтэрч байна..." : "Нэвтрэх"}
              </button>

              <button
                type="button"
                onClick={closePinModal}
                disabled={unlocking}
                className="w-full rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-600 disabled:opacity-50"
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
