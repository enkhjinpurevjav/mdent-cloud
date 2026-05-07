import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Drawer } from "../ui/Drawer";
import type { Announcement } from "../../types/announcements";

type NotificationBellProps = {
  className?: string;
  iconClassName?: string;
  title?: string;
};

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

export default function NotificationBell({
  className = "",
  iconClassName = "h-[18px] w-[18px] sm:h-5 sm:w-5",
  title = "Мэдэгдэл",
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements/unread-count", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const nextCount = Number(data?.unreadCount || 0);
      if (Number.isFinite(nextCount)) {
        setUnreadCount(nextCount);
      }
    } catch {
      // non-fatal count polling failure
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/announcements", {
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Мэдэгдэл ачаалж чадсангүй.");
      }
      const rows = Array.isArray(data?.announcements)
        ? (data.announcements as Announcement[])
        : [];
      setAnnouncements(rows);
      if (rows.length > 0 && !rows.some((r) => r.id === activeId)) {
        setActiveId(rows[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Мэдэгдэл ачаалж чадсангүй.");
      setAnnouncements([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    void loadUnreadCount();
    const timer = setInterval(() => {
      void loadUnreadCount();
    }, 60_000);
    return () => clearInterval(timer);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) return;
    void loadAnnouncements();
  }, [open, loadAnnouncements]);

  const markRead = useCallback(
    async (announcement: Announcement) => {
      if (announcement.readAt) return;
      try {
        const res = await fetch(`/api/announcements/${announcement.id}/read`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return;
        const nowIso = new Date().toISOString();
        setAnnouncements((prev) =>
          prev.map((row) =>
            row.id === announcement.id ? { ...row, readAt: nowIso } : row
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // non-fatal
      }
    },
    []
  );

  const activeAnnouncement = useMemo(
    () => announcements.find((row) => row.id === activeId) || null,
    [announcements, activeId]
  );

  const unreadRows = announcements.filter((row) => !row.readAt).length;

  return (
    <>
      <button
        title={title}
        onClick={() => setOpen(true)}
        className={`relative p-1.5 sm:p-2 rounded-lg text-white/85 hover:text-white ${className}`}
      >
        <Bell className={iconClassName} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={unreadRows > 0 ? `Мэдэгдэл (${unreadRows} уншаагүй)` : "Мэдэгдэл"}
      >
        <div className="space-y-3">
          {loading && (
            <p className="text-sm text-gray-500">Мэдэгдэл ачаалж байна...</p>
          )}
          {error && !loading && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && announcements.length === 0 && (
            <p className="text-sm text-gray-500">Мэдэгдэл алга.</p>
          )}

          {!loading && !error && announcements.length > 0 && (
            <div className="grid gap-3 md:grid-cols-[240px_1fr]">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {announcements.map((row) => {
                  const active = row.id === activeId;
                  return (
                    <button
                      key={row.id}
                      onClick={() => {
                        setActiveId(row.id);
                        void markRead(row);
                      }}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 ${
                        active ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {row.title}
                        </p>
                        {!row.readAt && (
                          <span className="mt-1 w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {formatDateTime(row.createdAt)}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                {activeAnnouncement ? (
                  <div className="space-y-3">
                    <h4 className="text-base font-semibold text-gray-900">
                      {activeAnnouncement.title}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(activeAnnouncement.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-gray-800">
                      {activeAnnouncement.body}
                    </p>

                    {activeAnnouncement.attachments &&
                      activeAnnouncement.attachments.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-2">
                            Хавсралт
                          </p>
                          <ul className="space-y-1">
                            {activeAnnouncement.attachments.map((file, idx) => (
                              <li key={`${file.filePath}-${idx}`}>
                                <a
                                  className="text-sm text-blue-600 hover:underline break-all"
                                  href={file.filePath}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {file.fileName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Мэдэгдэл сонгоно уу.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
