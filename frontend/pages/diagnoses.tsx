import React, { useEffect, useState } from "react";

type Diagnosis = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
};

type DiagnosisProblem = {
  id: number;
  diagnosisId: number;
  label: string;
  order: number;
  active: boolean;
};

export default function DiagnosesPage() {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingDx, setEditingDx] = useState<Diagnosis | null>(null);
  const [dxForm, setDxForm] = useState({
    code: "",
    name: "",
    description: "",
  });

  const [selectedDxId, setSelectedDxId] = useState<number | null>(null);
  const [problems, setProblems] = useState<DiagnosisProblem[]>([]);
  const [problemForm, setProblemForm] = useState({ label: "", order: 0 });
  const [problemError, setProblemError] = useState("");
  const [loadingProblems, setLoadingProblems] = useState(false);

  // ---- Load Diagnoses ----
  const loadDiagnoses = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/diagnoses");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }
      setDiagnoses(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Алдаа гарлаа");
      setDiagnoses([]);
    } finally {
      setLoading(false);
    }
  };

  // ---- Load Problems for selected diagnosis ----
  const loadProblems = async (diagnosisId: number) => {
    setLoadingProblems(true);
    setProblemError("");
    try {
      const res = await fetch(`/api/diagnoses/${diagnosisId}/problems`);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }
      setProblems(data);
    } catch (e: any) {
      console.error(e);
      setProblemError(e.message || "Алдаа гарлаа");
      setProblems([]);
    } finally {
      setLoadingProblems(false);
    }
  };

  useEffect(() => {
    loadDiagnoses();
  }, []);

  useEffect(() => {
    if (selectedDxId != null) {
      loadProblems(selectedDxId);
    } else {
      setProblems([]);
    }
  }, [selectedDxId]);

  // ---- Diagnosis form handlers ----
  const handleDxFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDxForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!dxForm.code.trim() || !dxForm.name.trim()) {
      setError("Код болон нэр заавал.");
      return;
    }

    try {
      const method = editingDx ? "PATCH" : "POST";
      const url = editingDx
        ? `/api/diagnoses/${editingDx.id}`
        : "/api/diagnoses";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: dxForm.code.trim(),
          name: dxForm.name.trim(),
          description: dxForm.description.trim() || null,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }

      setDxForm({ code: "", name: "", description: "" });
      setEditingDx(null);
      await loadDiagnoses();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Алдаа гарлаа");
    }
  };

  const handleDxEditClick = (dx: Diagnosis) => {
    setEditingDx(dx);
    setDxForm({
      code: dx.code,
      name: dx.name,
      description: dx.description || "",
    });
  };

  const handleDxDelete = async (dx: Diagnosis) => {
    if (!confirm(`"${dx.code} - ${dx.name}" оношийг устгах уу?`)) return;
    try {
      const res = await fetch(`/api/diagnoses/${dx.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }

      if (selectedDxId === dx.id) {
        setSelectedDxId(null);
      }
      await loadDiagnoses();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Алдаа гарлаа");
    }
  };

  // ---- Problem form handlers ----
  const handleProblemFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProblemForm((prev) => ({
      ...prev,
      [name]: name === "order" ? (value === "" ? 0 : Number(value)) : value,
    }));
  };

  const handleProblemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblemError("");

    if (selectedDxId == null) {
      setProblemError("Эхлээд онош сонгоно уу.");
      return;
    }
    if (!problemForm.label.trim()) {
      setProblemError("Проблемын нэр заавал.");
      return;
    }

    try {
      const res = await fetch(`/api/diagnoses/${selectedDxId}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: problemForm.label.trim(),
          order: Number(problemForm.order) || 0,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }

      setProblemForm({ label: "", order: 0 });
      await loadProblems(selectedDxId);
    } catch (e: any) {
      console.error(e);
      setProblemError(e.message || "Алдаа гарлаа");
    }
  };

  const toggleProblemActive = async (p: DiagnosisProblem) => {
    setProblemError("");
    try {
      const res = await fetch(`/api/diagnosis-problems/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }

      if (selectedDxId != null) {
        await loadProblems(selectedDxId);
      }
    } catch (e: any) {
      console.error(e);
      setProblemError(e.message || "Алдаа гарлаа");
    }
  };

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Оношийн тохиргоо</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Эмч нар онош сонгохдоо ашиглах код болон проблемын жагсаалтыг эндээс
        удирдана.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        {/* LEFT: Diagnoses list + form */}
        <section
          style={{
            padding: 16,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            Оношийн жагсаалт
          </h2>

          {error && (
            <div
              style={{
                marginBottom: 8,
                color: "#b91c1c",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleDxSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              columnGap: 8,
              rowGap: 6,
              marginBottom: 12,
            }}
          >
            <input
              name="code"
              placeholder="Код (ж: K04.1)"
              value={dxForm.code}
              onChange={handleDxFormChange}
              required
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
            <input
              name="name"
              placeholder="Нэр"
              value={dxForm.name}
              onChange={handleDxFormChange}
              required
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
            <input
              name="description"
              placeholder="Тайлбар (сонголттой)"
              value={dxForm.description}
              onChange={handleDxFormChange}
              style={{
                gridColumn: "1 / -1",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              {editingDx && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDx(null);
                    setDxForm({
                      code: "",
                      name: "",
                      description: "",
                    });
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#f9fafb",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Болих
                </button>
              )}
              <button
                type="submit"
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {editingDx ? "Засах" : "Нэмэх"}
              </button>
            </div>
          </form>

          {loading ? (
            <div>Ачаалж байна...</div>
          ) : diagnoses.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Онош бүртгэлгүй байна.
            </div>
          ) : (
            <div
              style={{
                maxHeight: 360,
                overflowY: "auto",
                borderTop: "1px solid #e5e7eb",
                marginTop: 8,
              }}
            >
              {diagnoses.map((dx) => {
                const isSelected = selectedDxId === dx.id;
                return (
                  <div
                    key={dx.id}
                    onClick={() => setSelectedDxId(dx.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 4px",
                      borderBottom: "1px solid #f3f4f6",
                      backgroundColor: isSelected
                        ? "#eff6ff"
                        : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div>
                        <strong>{dx.code}</strong> – {dx.name}
                      </div>
                      {dx.description && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            marginTop: 2,
                          }}
                        >
                          {dx.description}
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDxEditClick(dx);
                        }}
                        style={{
                          marginRight: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          borderRadius: 999,
                          border: "1px solid #2563eb",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          cursor: "pointer",
                        }}
                      >
                        Засах
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDxDelete(dx);
                        }}
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          borderRadius: 999,
                          border: "1px solid #dc2626",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          cursor: "pointer",
                        }}
                      >
                        Устгах
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT: Problems for selected diagnosis */}
        <section
          style={{
            padding: 16,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            Проблемын жагсаалт
          </h2>

          {selectedDxId == null ? (
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Зүүн талаас онош сонгосоны дараа уг оношид тохирсон
              проблемуудыг эндээс бүртгэнэ.
            </div>
          ) : (
            <>
              {problemError && (
                <div
                  style={{
                    marginBottom: 8,
                    color: "#b91c1c",
                    fontSize: 12,
                  }}
                >
                  {problemError}
                </div>
              )}

              <form
                onSubmit={handleProblemSubmit}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 80px auto",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <input
                  name="label"
                  placeholder="Проблем (ж: Шөнө өвдсөн)"
                  value={problemForm.label}
                  onChange={handleProblemFormChange}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
                <input
                  name="order"
                  type="number"
                  placeholder="Эрэмбэ"
                  value={problemForm.order}
                  onChange={handleProblemFormChange}
                  style={{
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "#ffffff",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Нэмэх
                </button>
              </form>

              {loadingProblems ? (
                <div>Ачаалж байна...</div>
              ) : problems.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Энэ оношид проблем бүртгээгүй байна.
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {problems.map((p) => (
                    <li
                      key={p.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 2px",
                        borderBottom: "1px solid #f3f4f6",
                        opacity: p.active ? 1 : 0.55,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            marginRight: 6,
                            color: "#9ca3af",
                            fontSize: 11,
                          }}
                        >
                          {p.order}
                        </span>
                        {p.label}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleProblemActive(p)}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid #d1d5db",
                          background: p.active ? "#f9fafb" : "#fee2e2",
                          color: p.active ? "#374151" : "#b91c1c",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        {p.active ? "Идэвхгүй болгох" : "Идэвхтэй болгох"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
