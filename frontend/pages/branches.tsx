import React, { useState, useEffect } from "react";

type Branch = {
  id: number;
  name: string;
  address: string | null;
  createdAt?: string;
};

function BranchForm({ onSuccess }: { onSuccess: (b: Branch) => void }) {
  const [form, setForm] = useState({
    name: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok) {
        onSuccess(data as Branch);
        setForm({ name: "", address: "" });
      } else {
        setError((data && data.error) || "Алдаа гарлаа");
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: 24,
        padding: 16,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 12,
          fontSize: 16,
        }}
      >
        Шинэ салбар бүртгэх
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label>Нэр</label>
          <input
            name="name"
            placeholder="Ж: Төв салбар / Maral branch"
            value={form.name}
            onChange={handleChange}
            required
            style={{
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label>Хаяг</label>
          <input
            name="address"
            placeholder="Ж: УБ, Баянгол дүүрэг ..."
            value={form.address}
            onChange={handleChange}
            style={{
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
        }}
      >
        {error && (
          <div style={{ color: "#b91c1c", fontSize: 12, marginRight: "auto" }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            cursor: submitting ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          {submitting ? "Бүртгэж байна..." : "Бүртгэх"}
        </button>
      </div>
    </form>
  );
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; address: string }>({
    name: "",
    address: "",
  });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editError, setEditError] = useState("");

  const loadBranches = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/branches");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.ok && Array.isArray(data)) {
        setBranches(data);
      } else {
        setError(
          (data && data.error) || "Салбарын жагсаалтыг ачааллаж чадсангүй"
        );
      }
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const startEdit = (b: Branch) => {
    setEditingId(b.id);
    setEditValues({
      name: b.name,
      address: b.address || "",
    });
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ name: "", address: "" });
    setSavingId(null);
    setEditError("");
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "name" | "address"
  ) => {
    const value = e.target.value;
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const saveEdit = async (b: Branch) => {
    if (!editValues.name.trim()) {
      setEditError("Нэр талбарыг хоосон байлгаж болохгүй.");
      return;
    }
    setSavingId(b.id);
    setEditError("");

    try {
      const res = await fetch(`/api/branches/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editValues.name.trim(),
          address: editValues.address.trim() || null,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        setEditError((data && data.error) || "Салбар засварлахад алдаа гарлаа.");
        setSavingId(null);
        return;
      }

      const updated = data as Branch;
      setBranches((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
      );
      setEditingId(null);
      setSavingId(null);
    } catch {
      setEditError("Сүлжээгээ шалгана уу.");
      setSavingId(null);
    }
  };

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "16px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "4px 0 8px" }}>Салбар болон Эмнэлэг</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        Эмнэлгийн салбаруудын нэр, хаягийг бүртгэх, засварлах.
      </p>

      <BranchForm
        onSuccess={(b) => {
          setBranches((bs) => [b, ...bs]);
        }}
      />

      {loading && (
        <div style={{ color: "#4b5563", fontSize: 13 }}>Ачааллаж байна...</div>
      )}
      {!loading && error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <section
          style={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            padding: 12,
          }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Салбарын жагсаалт</h2>
          {editError && (
            <div
              style={{
                color: "#b91c1c",
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {editError}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 6px",
                      fontWeight: 600,
                      fontSize: 12,
                      color: "#4b5563",
                    }}
                  >
                    ID
                  </th>
                  <th style={{ ...thStyle }}>Нэр</th>
                  <th style={{ ...thStyle }}>Хаяг</th>
                  <th style={{ ...thStyle }}>Үүссэн огноо</th>
                  <th
                    style={{
                      ...thStyle,
                      textAlign: "right",
                    }}
                  >
                    Үйлдэл
                  </th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => {
                  const isEditing = editingId === b.id;
                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        backgroundColor: "white",
                      }}
                    >
                      <td style={tdStyle}>{b.id}</td>

                      {/* Name cell */}
                      <td style={tdStyle}>
                        {isEditing ? (
                          <input
                            value={editValues.name}
                            onChange={(e) => handleEditChange(e, "name")}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                              fontSize: 12,
                            }}
                          />
                        ) : (
                          b.name
                        )}
                      </td>

                      {/* Address cell */}
                      <td style={tdStyle}>
                        {isEditing ? (
                          <input
                            value={editValues.address}
                            onChange={(e) => handleEditChange(e, "address")}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              padding: "4px 6px",
                              fontSize: 12,
                            }}
                          />
                        ) : (
                          b.address || ""
                        )}
                      </td>

                      {/* CreatedAt */}
                      <td style={tdStyle}>
                        {b.createdAt
                          ? new Date(b.createdAt).toLocaleString("mn-MN")
                          : ""}
                      </td>

                      {/* Actions */}
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => startEdit(b)}
                            style={{
                              padding: "3px 10px",
                              borderRadius: 6,
                              border: "1px solid #2563eb",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Засах
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(b)}
                              disabled={savingId === b.id}
                              style={{
                                padding: "3px 10px",
                                borderRadius: 6,
                                border: "none",
                                background: "#16a34a",
                                color: "white",
                                fontSize: 12,
                                cursor:
                                  savingId === b.id ? "default" : "pointer",
                                marginRight: 6,
                              }}
                            >
                              {savingId === b.id ? "Хадгалж байна..." : "Хадгалах"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={savingId === b.id}
                              style={{
                                padding: "3px 10px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                background: "#f9fafb",
                                color: "#374151",
                                fontSize: 12,
                                cursor:
                                  savingId === b.id ? "default" : "pointer",
                              }}
                            >
                              Болих
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {branches.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        color: "#9ca3af",
                        padding: 12,
                        fontSize: 13,
                      }}
                    >
                      Өгөгдөл алга
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 6px",
  fontWeight: 600,
  fontSize: 12,
  color: "#4b5563",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 6px",
  fontSize: 13,
  color: "#111827",
};
