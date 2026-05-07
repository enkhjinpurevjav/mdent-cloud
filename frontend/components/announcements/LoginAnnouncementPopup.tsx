import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { Announcement } from "../../types/announcements";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LoginAnnouncementPopup() {
  const { me } = useAuth();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me?.id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/announcements/login-popup", {
          credentials: "include",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || cancelled) return;
        const next = data?.announcement ?? null;
        if (next) {
          setAnnouncement(next as Announcement);
          setOpen(true);
          setDontShowAgain(false);
          setError("");
        }
      } catch {
        // non-fatal
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [me?.id]);

  const createdLabel = useMemo(
    () => formatDateTime(announcement?.createdAt),
    [announcement?.createdAt]
  );

  if (!open || !announcement) return null;

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl bg-white rounded-xl shadow-xl p-5">
        <h2 className="text-lg font-bold text-gray-900">{announcement.title}</h2>
        {createdLabel && (
          <p className="text-xs text-gray-500 mt-1">{createdLabel}</p>
        )}

        <div className="mt-4 space-y-3">
          {announcement.contentMode === "IMAGE" && announcement.imagePath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={announcement.imagePath}
              alt={announcement.title}
              className="max-h-[360px] w-full object-contain rounded-lg border border-gray-200"
            />
          )}

          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {announcement.body}
          </p>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="mt-0.5"
          />
          <span>Дахиж харуулахгүй (энэ мэдэгдлийг бүрэн уншиж танилцсан).</span>
        </label>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setError("");
              try {
                const res = await fetch(
                  `/api/announcements/${announcement.id}/acknowledge-popup`,
                  {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dontShowAgain }),
                  }
                );
                const data = await res.json().catch(() => null);
                if (!res.ok) {
                  throw new Error(data?.error || "Мэдэгдлийг хадгалж чадсангүй.");
                }
                setOpen(false);
                setAnnouncement(null);
              } catch (err: any) {
                setError(err?.message || "Мэдэгдлийг хадгалж чадсангүй.");
              } finally {
                setSubmitting(false);
              }
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Хадгалж байна..." : "Уншиж танилцлаа"}
          </button>
        </div>
      </div>
    </div>
  );
}
