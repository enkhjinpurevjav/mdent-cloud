import React, { useEffect, useState } from "react";

type GiftCardRow = {
  id: number;
  code: string;
  note: string;
  value: number;
  remainingBalance: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function formatMoney(v: number) {
  return new Intl.NumberFormat("mn-MN").format(Number(v || 0));
}

function formatDateOnly(iso?: string) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("mn-MN");
  } catch {
    return iso;
  }
}

export default function GiftCardsPage() {
  const [rows, setRows] = useState<GiftCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addNote, setAddNote] = useState("");

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<GiftCardRow | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editRemaining, setEditRemaining] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const load = async (q?: string) => {
    setLoading(true);
    setError("");
    try {
      const url = q
        ? `/api/admin/giftcards?search=${encodeURIComponent(q)}`
        : "/api/admin/giftcards";
      const res = await fetch(url);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to load gift cards");
      setRows((data?.giftCards || []) as GiftCardRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load gift cards");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void load(search.trim());
  };

  const openAdd = () => {
    setAddValue("");
    setAddNote("");
    setAddOpen(true);
  };

  const handleAdd = async () => {
    const valueNum = Number(addValue);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      alert("Үнэ цэнийн дүн зөв оруулна уу.");
      return;
    }

    try {
      const res = await fetch("/api/admin/giftcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: valueNum, note: addNote.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to create gift card");
      setAddOpen(false);
      await load(search.trim() || undefined);
    } catch (e: any) {
      alert(e?.message || "Failed to create gift card");
    }
  };

  const openEdit = (row: GiftCardRow) => {
    setEditing(row);
    setEditNote(row.note);
    setEditValue(String(row.value));
    setEditRemaining(String(row.remainingBalance));
    setEditIsActive(row.isActive);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;

    const valueNum = Number(editValue);
    const remNum = Number(editRemaining);

    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      alert("Үнэ цэнийн дүн зөв оруулна уу.");
      return;
    }
    if (!Number.isFinite(remNum) || remNum < 0) {
      alert("Үлдэгдэл зөв оруулна уу.");
      return;
    }
    if (remNum > valueNum) {
      alert("Үлдэгдэл нь үнэ цэнээс их байж болохгүй.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/giftcards/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: editNote.trim(),
          isActive: editIsActive,
          value: valueNum,
          remainingBalance: remNum,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update gift card");
      setEditOpen(false);
      setEditing(null);
      await load(search.trim() || undefined);
    } catch (e: any) {
      alert(e?.message || "Failed to update gift card");
    }
  };

  const handleDeactivate = async (row: GiftCardRow) => {
    if (!confirm(`Бэлгийн карт (${row.code}) идэвхгүй болгох уу?`)) return;
    try {
      const res = await fetch(`/api/admin/giftcards/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to deactivate");
      await load(search.trim() || undefined);
    } catch (e: any) {
      alert(e?.message || "Failed to deactivate gift card");
    }
  };

  const GRID_COLS = "120px 1fr 130px 130px 110px 110px 90px 170px";

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 12,
    padding: 28,
    minWidth: 360,
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };
  const fieldStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 14,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
  };
  const inputStyle: React.CSSProperties = {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    outline: "none",
  };

  return (
    <main
      style={{
        maxWidth: 1500,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Бэлгийн карт</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Бэлгийн картын код, үнэ цэн, үлдэгдэл, тэмдэглэлийг удирдах
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <form
            onSubmit={handleSearch}
            style={{ display: "flex", gap: 6 }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Код эсвэл тэмдэглэл хайх..."
              style={{ ...inputStyle, width: 220 }}
            />
            <button
              type="submit"
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid #6b7280",
                background: "#f9fafb",
                color: "#374151",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Хайх
            </button>
          </form>
          <button
            type="button"
            onClick={openAdd}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #16a34a",
              background: "#f0fdf4",
              color: "#166534",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            + Бэлгийн карт нэмэх
          </button>
        </div>
      </div>

      {loading && <div style={{ marginTop: 14 }}>Ачаалж байна...</div>}
      {!loading && error && (
        <div style={{ marginTop: 14, color: "#b91c1c" }}>{error}</div>
      )}

      {!loading && !error && (
        <div
          style={{
            marginTop: 14,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLS,
              gap: 10,
              padding: "10px 12px",
              background: "#f9fafb",
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
              alignItems: "center",
            }}
          >
            <div>Код</div>
            <div>Тэмдэглэл</div>
            <div style={{ textAlign: "right" }}>Үнэ цэн</div>
            <div style={{ textAlign: "right" }}>Үлдэгдэл</div>
            <div>Үүссэн огноо</div>
            <div>Шинэчлэгдсэн</div>
            <div>Төлөв</div>
            <div />
          </div>

          {/* Data rows */}
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: GRID_COLS,
                gap: 10,
                padding: "10px 12px",
                borderTop: "1px solid #f3f4f6",
                fontSize: 13,
                alignItems: "center",
                opacity: r.isActive ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#374151",
                  letterSpacing: "0.05em",
                }}
              >
                {r.code}
              </div>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: r.note ? "#374151" : "#9ca3af",
                  fontStyle: r.note ? "normal" : "italic",
                }}
                title={r.note}
              >
                {r.note || "—"}
              </div>
              <div style={{ textAlign: "right" }}>
                {formatMoney(r.value)} ₮
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontWeight: 700,
                  color: r.remainingBalance > 0 ? "#166534" : "#b91c1c",
                }}
              >
                {formatMoney(r.remainingBalance)} ₮
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {formatDateOnly(r.createdAt)}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {formatDateOnly(r.updatedAt)}
              </div>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 11,
                    background: r.isActive ? "#dcfce7" : "#f3f4f6",
                    color: r.isActive ? "#166534" : "#6b7280",
                    fontWeight: 600,
                  }}
                >
                  {r.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Засах
                </button>
                {r.isActive && (
                  <button
                    type="button"
                    onClick={() => handleDeactivate(r)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #dc2626",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Идэвхгүй болгох
                  </button>
                )}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: "#6b7280" }}>
              Одоогоор ямар ч бэлгийн карт бүртгэгдээгүй байна.
            </div>
          )}
        </div>
      )}

      {/* ── Add Modal ── */}
      {addOpen && (
        <div style={backdropStyle} onClick={() => setAddOpen(false)}>
          <div
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 17 }}>
              Бэлгийн карт нэмэх
            </h2>
            <div style={{ marginBottom: 14, fontSize: 12, color: "#6b7280" }}>
              8 оронтой дугаарыг автоматаар үүсгэнэ.
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Үнэ цэн (₮)</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Тэмдэглэл (хэнд өгсөн, хаанаас авсан гэх мэт)
              </label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="Жишээ: Эрхэм 8-ны найз Б.Намуун..."
              />
            </div>

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
                onClick={() => setAddOpen(false)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  color: "#374151",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Болих
              </button>
              <button
                type="button"
                onClick={handleAdd}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #16a34a",
                  background: "#f0fdf4",
                  color: "#166534",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Нэмэх
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editOpen && editing && (
        <div style={backdropStyle} onClick={() => setEditOpen(false)}>
          <div
            style={{ ...modalStyle, maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>
              Бэлгийн карт засах
            </h2>
            <div style={{ marginBottom: 14, fontSize: 12, color: "#6b7280" }}>
              Код:{" "}
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                {editing.code}
              </span>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Тэмдэглэл (хэнд өгсөн, хаанаас авсан гэх мэт)
              </label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={fieldStyle}>
                <label style={labelStyle}>Үнэ цэн (₮)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Үлдэгдэл (₮)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={editRemaining}
                  onChange={(e) => setEditRemaining(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <input
                id="editGiftCardIsActive"
                type="checkbox"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                style={{ width: 15, height: 15 }}
              />
              <label
                htmlFor="editGiftCardIsActive"
                style={{ ...labelStyle, cursor: "pointer" }}
              >
                Идэвхтэй
              </label>
            </div>

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
                  setEditOpen(false);
                  setEditing(null);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  color: "#374151",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Болих
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
