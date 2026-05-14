import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type {
  Announcement,
  AnnouncementAttachment,
  AnnouncementContentMode,
  AnnouncementType,
} from "../../types/announcements";

type Branch = { id: number; name: string };

const TARGET_ROLE_OPTIONS = [
  { value: "admin", label: "Админ" },
  { value: "super_admin", label: "Супер админ" },
  { value: "hr", label: "Хүний нөөц" },
  { value: "doctor", label: "Эмч" },
  { value: "nurse", label: "Сувилагч" },
  { value: "receptionist", label: "Ресепшн" },
  { value: "marketing", label: "Маркетинг" },
  { value: "accountant", label: "Нягтлан" },
  { value: "manager", label: "Менежер" },
  { value: "xray", label: "Рентген" },
  { value: "sterilization", label: "Ариутгал" },
  { value: "other", label: "Бусад" },
  { value: "branch_kiosk", label: "Салбар киоск" },
  { value: "branch_nurse_kiosk", label: "Сувилагч киоск" },
  { value: "doctor_kiosk", label: "Эмч киоск" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function HrAnnouncementsPage() {
  const { me, loading } = useAuth();
  const canManage = me?.role === "hr" || me?.role === "super_admin";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<(Announcement & { readCount?: number; dontShowAgainCount?: number })[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<AnnouncementType>("LOGIN_POPUP");
  const [contentMode, setContentMode] = useState<AnnouncementContentMode>("TEXT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetBranchIds, setTargetBranchIds] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);

  const isAlertType = type === "ALERT_LIST";
  const isPopupImage = type === "LOGIN_POPUP" && contentMode === "IMAGE";

  const resetForm = () => {
    setType("LOGIN_POPUP");
    setContentMode("TEXT");
    setTitle("");
    setBody("");
    setImagePath("");
    setTargetRoles([]);
    setTargetBranchIds([]);
    setStartsAt("");
    setEndsAt("");
    setIsActive(true);
    setAttachments([]);
  };

  const loadData = async () => {
    if (!canManage) return;
    setListLoading(true);
    setError("");
    try {
      const [branchesRes, manageRes] = await Promise.all([
        fetch("/api/branches", { credentials: "include" }),
        fetch("/api/announcements/manage", { credentials: "include" }),
      ]);

      const branchesJson = await branchesRes.json().catch(() => []);
      const manageJson = await manageRes.json().catch(() => null);

      if (!branchesRes.ok) {
        throw new Error("Салбарын мэдээлэл ачаалж чадсангүй.");
      }
      if (!manageRes.ok) {
        throw new Error(manageJson?.error || "Мэдэгдлийн жагсаалт ачаалж чадсангүй.");
      }

      setBranches(Array.isArray(branchesJson) ? branchesJson : []);
      setRows(Array.isArray(manageJson?.announcements) ? manageJson.announcements : []);
    } catch (err: any) {
      setError(err?.message || "Өгөгдөл ачаалж чадсангүй.");
      setRows([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const roleSummary = useMemo(() => {
    if (targetRoles.length === 0) return "Бүх үүрэг";
    return targetRoles.join(", ");
  }, [targetRoles]);

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">ачаалж байна...</div>;
  }

  if (!canManage) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Энэ хуудсыг зөвхөн Хүний нөөц эсвэл Супер админ ашиглах боломжтой.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Хүний нөөц — Мэдэгдэл</h1>

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Шинэ мэдэгдэл үүсгэх</h2>

        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Төрөл</span>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as AnnouncementType;
                setType(nextType);
                if (nextType === "ALERT_LIST") {
                  setContentMode("TEXT");
                }
              }}
            >
              <option value="LOGIN_POPUP">LOGIN_POPUP</option>
              <option value="ALERT_LIST">ALERT_LIST</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Popup агуулгын төрөл</span>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={contentMode}
              disabled={type !== "LOGIN_POPUP"}
              onChange={(e) =>
                setContentMode(e.target.value as AnnouncementContentMode)
              }
            >
              <option value="TEXT">TEXT</option>
              <option value="IMAGE">IMAGE</option>
            </select>
          </label>

          <label className="text-sm flex items-end gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="text-gray-700">Идэвхтэй</span>
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Гарчиг</span>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Гарчиг"
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Хүчингүй болох хугацаа</span>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>

        <label className="text-sm block">
          <span className="block mb-1 text-gray-700">Эхлэх хугацаа</span>
          <input
            type="datetime-local"
            className="w-full md:w-1/2 border rounded-lg px-3 py-2"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>

        <label className="text-sm block">
          <span className="block mb-1 text-gray-700">Текст</span>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[110px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Мэдэгдлийн текст"
          />
        </label>

        {isPopupImage && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Popup зураг
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  setSaving(true);
                  try {
                    const res = await fetch("/api/uploads/announcement-image", {
                      method: "POST",
                      credentials: "include",
                      body: fd,
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok) {
                      throw new Error(data?.error || "Зураг upload алдаа.");
                    }
                    setImagePath(String(data?.filePath || ""));
                  } catch (err: any) {
                    setError(err?.message || "Зураг upload алдаа.");
                  } finally {
                    setSaving(false);
                    e.target.value = "";
                  }
                }}
              />
            </div>
            {imagePath && (
              <div className="border border-gray-200 rounded-lg p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePath}
                  alt="popup-preview"
                  className="max-h-56 object-contain"
                />
                <p className="text-xs text-gray-500 mt-2 break-all">{imagePath}</p>
              </div>
            )}
          </div>
        )}

        {isAlertType && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                ALERT хавсралт
              </label>
              <input
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  setSaving(true);
                  try {
                    const res = await fetch(
                      "/api/uploads/announcement-attachment",
                      {
                        method: "POST",
                        credentials: "include",
                        body: fd,
                      }
                    );
                    const data = await res.json().catch(() => null);
                    if (!res.ok) {
                      throw new Error(data?.error || "Хавсралт upload алдаа.");
                    }
                    const next: AnnouncementAttachment = {
                      filePath: String(data?.filePath || ""),
                      fileName: String(data?.fileName || file.name),
                      mimeType: String(data?.mimeType || file.type || "application/octet-stream"),
                      sizeBytes: Number(data?.sizeBytes || file.size || 0),
                    };
                    setAttachments((prev) => [...prev, next]);
                  } catch (err: any) {
                    setError(err?.message || "Хавсралт upload алдаа.");
                  } finally {
                    setSaving(false);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((a, idx) => (
                  <li key={`${a.filePath}-${idx}`} className="flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2">
                    <a href={a.filePath} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                      {a.fileName}
                    </a>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Устгах
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Зорилтот үүрэг ({roleSummary})
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-auto border border-gray-200 rounded-lg p-3">
              {TARGET_ROLE_OPTIONS.map((opt) => {
                const checked = targetRoles.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setTargetRoles((prev) =>
                          e.target.checked
                            ? [...prev, opt.value]
                            : prev.filter((v) => v !== opt.value)
                        );
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Зорилтот салбар (хоосон бол бүх салбар)
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-auto border border-gray-200 rounded-lg p-3">
              {branches.map((branch) => {
                const checked = targetBranchIds.includes(branch.id);
                return (
                  <label key={branch.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setTargetBranchIds((prev) =>
                          e.target.checked
                            ? [...prev, branch.id]
                            : prev.filter((v) => v !== branch.id)
                        );
                      }}
                    />
                    <span>{branch.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                const payload = {
                  type,
                  contentMode: type === "LOGIN_POPUP" ? contentMode : "TEXT",
                  title,
                  body,
                  imagePath: isPopupImage ? imagePath : null,
                  targetRoles,
                  targetBranchIds,
                  startsAt: toIsoOrNull(startsAt),
                  endsAt: toIsoOrNull(endsAt),
                  isActive,
                  attachments: isAlertType ? attachments : [],
                };
                const res = await fetch("/api/announcements/manage", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) {
                  throw new Error(data?.error || "Мэдэгдэл үүсгэж чадсангүй.");
                }
                resetForm();
                await loadData();
              } catch (err: any) {
                setError(err?.message || "Мэдэгдэл үүсгэж чадсангүй.");
              } finally {
                setSaving(false);
              }
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setError("");
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm"
          >
            Цэвэрлэх
          </button>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Мэдэгдлийн жагсаалт</h2>
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => void loadData()}
          >
            Шинэчлэх
          </button>
        </div>

        {listLoading ? (
          <p className="text-sm text-gray-500">ачаалж байна...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">Мэдэгдэл алга.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {row.title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {row.type} • {row.contentMode} • Үүсгэсэн: {formatDate(row.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/announcements/manage/${row.id}`, {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isActive: !row.isActive }),
                        });
                        const data = await res.json().catch(() => null);
                        if (!res.ok) {
                          throw new Error(data?.error || "Төлөв өөрчилж чадсангүй.");
                        }
                        await loadData();
                      } catch (err: any) {
                        setError(err?.message || "Төлөв өөрчилж чадсангүй.");
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      row.isActive
                        ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {row.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                  </button>
                </div>

                <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2">
                  {row.body}
                </p>

                {row.imagePath && (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.imagePath}
                      alt={row.title}
                      className="max-h-48 rounded border border-gray-200"
                    />
                  </div>
                )}

                {row.attachments && row.attachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {row.attachments.map((a, idx) => (
                      <li key={`${a.filePath}-${idx}`}>
                        <a
                          href={a.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {a.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-3">
                  <span>Уншсан: {row.readCount ?? 0}</span>
                  <span>Дахиж харуулахгүй: {row.dontShowAgainCount ?? 0}</span>
                  <span>Эхлэх: {formatDate(row.startsAt)}</span>
                  <span>Дуусах: {formatDate(row.endsAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
