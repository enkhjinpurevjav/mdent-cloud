import React, { useEffect, useMemo, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type ServiceCategory =
  | "ORTHODONTIC_TREATMENT"
  | "IMAGING"
  | "DEFECT_CORRECTION"
  | "ADULT_TREATMENT"
  | "WHITENING"
  | "CHILD_TREATMENT"
  | "SURGERY";

type ServiceBranch = {
  branchId: number;
  branch: Branch;
};

type Service = {
  id: number;
  code?: string | null;
  category: ServiceCategory;
  name: string;
  price: number;
  isActive: boolean;
  description?: string | null;
  serviceBranches: ServiceBranch[];
};

const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  ORTHODONTIC_TREATMENT: "Гажиг заслын эмчилгээ",
  IMAGING: "Зураг авах",
  DEFECT_CORRECTION: "Согог засал",
  ADULT_TREATMENT: "Том хүний эмчилгээ",
  WHITENING: "Цайруулалт",
  CHILD_TREATMENT: "Хүүхдийн эмчилгээ",
  SURGERY: "Мэс засал",
};

export default function ServicesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [filterCategory, setFilterCategory] = useState<"" | ServiceCategory>("");
  const [filterBranchId, setFilterBranchId] = useState<number | "">("");
  const [filterOnlyActive, setFilterOnlyActive] = useState(true);
  const [filterSearch, setFilterSearch] = useState("");

  // create form
  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "" as "" | ServiceCategory,
    description: "",
    code: "",
    branchIds: [] as number[],
    isActive: true,
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    price: string;
    category: ServiceCategory | "";
    description: string;
    code: string;
    isActive: boolean;
    branchIds: number[];
  }>({
    name: "",
    price: "",
    category: "",
    description: "",
    code: "",
    isActive: true,
    branchIds: [],
  });
  const [editError, setEditError] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (filterBranchId) params.set("branchId", String(filterBranchId));
    if (filterOnlyActive) params.set("onlyActive", "true");
    return params.toString();
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const query = buildQuery();
      const [bRes, sRes] = await Promise.all([
        fetch("/api/branches"),
        fetch(`/api/services${query ? `?${query}` : ""}`),
      ]);

      const [bData, sData] = await Promise.all([bRes.json(), sRes.json()]);

      if (!bRes.ok || !Array.isArray(bData)) {
        throw new Error("branches load failed");
      }
      if (!sRes.ok || !Array.isArray(sData)) {
        throw new Error("services load failed");
      }

      setBranches(bData);
      setServices(
        [...sData].sort((a, b) =>
          a.name.toString().localeCompare(b.name.toString(), "mn")
        )
      );
      setPage(1);
    } catch (e) {
      console.error(e);
      setError("Өгөгдөл ачааллах үед алдаа гарлаа");
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterBranchId, filterOnlyActive]);

  const toggleCreateBranch = (branchId: number) => {
    setForm((prev) => {
      const has = prev.branchIds.includes(branchId);
      return {
        ...prev,
        branchIds: has
          ? prev.branchIds.filter((id) => id !== branchId)
          : [...prev.branchIds, branchId],
      };
    });
  };

  const toggleEditBranch = (branchId: number) => {
    setEditForm((prev) => {
      const has = prev.branchIds.includes(branchId);
      return {
        ...prev,
        branchIds: has
          ? prev.branchIds.filter((id) => id !== branchId)
          : [...prev.branchIds, branchId],
      };
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!form.name || !form.price || !form.category) {
      setFormError("Нэр, үнэ, категори талбаруудыг заавал бөглөнө үү.");
      return;
    }
    if (!form.branchIds.length) {
      setFormError("Ядаж нэг салбар сонгоно уу.");
      return;
    }
    if (Number.isNaN(Number(form.price)) || Number(form.price) <= 0) {
      setFormError("Үнийн дүн 0-ээс их тоо байх ёстой.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        price: Number(form.price),
        category: form.category,
        description: form.description || undefined,
        code: form.code || undefined,
        isActive: form.isActive,
        branchIds: form.branchIds,
      };

      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setServices((prev) =>
          [...prev, data].sort((a, b) =>
            a.name.toString().localeCompare(b.name.toString(), "mn")
          )
        );
        setForm({
          name: "",
          price: "",
          category: "",
          description: "",
          code: "",
          branchIds: [],
          isActive: true,
        });
        setFormError("");
        setPage(1);
      } else {
        setFormError(data.error || "Үйлчилгээ хадгалах үед алдаа гарлаа.");
      }
    } catch {
      setFormError("Сүлжээгээ шалгана уу.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (s: Service) => {
    setEditingId(s.id);
    setEditError("");
    setEditForm({
      name: s.name,
      price: String(s.price),
      category: s.category,
      description: s.description || "",
      code: s.code || "",
      isActive: s.isActive,
      branchIds: s.serviceBranches?.map((sb) => sb.branchId) || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError("");
  };

  const handleEditChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type, checked } = e.target as any;
    if (type === "checkbox" && name === "isActive") {
      setEditForm((prev) => ({ ...prev, isActive: checked }));
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      [name]: name === "category" ? (value as ServiceCategory) : value,
    }));
  };

  const saveEdit = async (id: number) => {
    setEditError("");

    if (!editForm.name || !editForm.price || !editForm.category) {
      setEditError("Нэр, үнэ, категори шаардлагатай.");
      return;
    }
    if (!editForm.branchIds.length) {
      setEditError("Ядаж нэг салбар сонгоно уу.");
      return;
    }
    if (Number.isNaN(Number(editForm.price)) || Number(editForm.price) <= 0) {
      setEditError("Үнийн дүн 0-ээс их тоо байх ёстой.");
      return;
    }

    try {
      const payload: any = {
        name: editForm.name,
        price: Number(editForm.price),
        category: editForm.category,
        description: editForm.description || null,
        code: editForm.code || null,
        isActive: editForm.isActive,
        branchIds: editForm.branchIds,
      };

      const res = await fetch(`/api/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Хадгалах үед алдаа гарлаа.");
        return;
      }

      setServices((prev) =>
        [...prev].map((s) => (s.id === id ? data : s)).sort((a, b) =>
          a.name.toString().localeCompare(b.name.toString(), "mn")
        )
      );
      setEditingId(null);
      setEditError("");
    } catch (err) {
      console.error(err);
      setEditError("Сүлжээгээ шалгана уу.");
    }
  };

  const deleteService = async (id: number) => {
    const ok = window.confirm(
      "Та энэхүү үйлчилгээг устгахдаа итгэлтэй байна уу?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        alert((data && data.error) || "Устгах үед алдаа гарлаа");
        return;
      }

      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  // Filter + search + pagination
  const filteredServices = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return services;

    return services.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const code = (s.code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [services, filterSearch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredServices.length / pageSize)
  );
  const safePage = Math.min(page, totalPages);
  const pagedServices = useMemo(
    () =>
      filteredServices.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
      ),
    [filteredServices, safePage]
  );

  const [collapsedCategories, setCollapsedCategories] = useState<
    Partial<Record<ServiceCategory, boolean>>
  >({});

  const toggleCategory = (cat: ServiceCategory) =>
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const servicesByCategory = useMemo(() => {
    const groups: Record<ServiceCategory, Service[]> = {
      ORTHODONTIC_TREATMENT: [],
      IMAGING: [],
      DEFECT_CORRECTION: [],
      ADULT_TREATMENT: [],
      WHITENING: [],
      CHILD_TREATMENT: [],
      SURGERY: [],
    };
    pagedServices.forEach((s) => {
      groups[s.category].push(s);
    });
    return groups;
  }, [pagedServices]);

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "16px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "4px 0 8px" }}>Үйлчилгээ</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        Үйлчилгээний нэр, үнэ, категори болон салбаруудыг бүртгэх, засварлах.
      </p>

      {/* Create service form – polished card */}
      <section
        style={{
          marginTop: 8,
          marginBottom: 16,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, marginBottom: 8 }}>
          Шинэ үйлчилгээ бүртгэх
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 12,
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          Зөвхөн нэр, үнэ, категори болон салбарыг заавал бөглөнө. Код, тайлбар
          талбарууд сонголттой.
        </p>

        <form onSubmit={handleCreateSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginBottom: 10,
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label>Нэр</label>
              <input
                placeholder="Ж: Шүдний цоорхой пломбдох"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label>Үнэ (₮)</label>
              <input
                type="number"
                placeholder="Ж: 50000"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                required
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label>Категори</label>
              <select
                value={form.category || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value
                      ? (e.target.value as ServiceCategory)
                      : "",
                  }))
                }
                required
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                }}
              >
                <option value="">Категори сонгох</option>
                {Object.entries(SERVICE_CATEGORY_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <label>Код</label>
              <input
                placeholder="Ж: S0001 (хоосон бол автоматаар үүснэ)"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                gridColumn: "1 / -1",
              }}
            >
              <label>Тайлбар</label>
              <textarea
                placeholder="Ж: Энгийн цоорхой пломбдолт, мэдээ алдуулалттай"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                rows={2}
                style={{
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                  resize: "vertical",
                }}
              />
            </div>

            {/* branch selection */}
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <label>Салбарууд</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {branches.map((b) => (
                  <label
                    key={b.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      border: "1px solid #d1d5db",
                      borderRadius: 999,
                      padding: "3px 8px",
                      fontSize: 12,
                      background: form.branchIds.includes(b.id)
                        ? "#eff6ff"
                        : "#ffffff",
                      color: form.branchIds.includes(b.id)
                        ? "#1d4ed8"
                        : "#374151",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.branchIds.includes(b.id)}
                      onChange={() => toggleCreateBranch(b.id)}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
              }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              Идэвхтэй
            </label>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              alignItems: "center",
            }}
          >
            {formError && (
              <div
                style={{
                  color: "#b91c1c",
                  fontSize: 12,
                  marginRight: "auto",
                }}
              >
                {formError}
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
              {submitting ? "Хадгалж байна..." : "Бүртгэх"}
            </button>
          </div>
        </form>
      </section>

      {/* Filters card */}
      <section
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Шүүлтүүр</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 10,
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Категори</label>
            <select
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(
                  e.target.value ? (e.target.value as ServiceCategory) : ""
                )
              }
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Бүгд</option>
              {Object.entries(SERVICE_CATEGORY_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label>Салбар</label>
            <select
              value={filterBranchId === "" ? "" : String(filterBranchId)}
              onChange={(e) =>
                setFilterBranchId(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Бүгд</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 18,
            }}
          >
            <input
              type="checkbox"
              id="onlyActive"
              checked={filterOnlyActive}
              onChange={(e) => setFilterOnlyActive(e.target.checked)}
            />
            <label htmlFor="onlyActive">Зөвхөн идэвхтэй</label>
          </div>
        </div>

        <input
          placeholder="Нэр, кодоор хайх..."
          value={filterSearch}
          onChange={(e) => {
            setFilterSearch(e.target.value);
            setPage(1);
          }}
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            padding: "6px 8px",
            fontSize: 13,
          }}
        />
      </section>

      {loading && (
        <div style={{ color: "#4b5563", fontSize: 13 }}>Ачааллаж байна...</div>
      )}
      {!loading && error && (
        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Services list */}
      {!loading && !error && (
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>
            Бүртгэлтэй үйлчилгээ
          </h2>
          {editError && (
            <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>
              {editError}
            </div>
          )}
          {filteredServices.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              Үйлчилгээ алга.
            </div>
          ) : (
            <>
              <div
                style={{
                  maxHeight: 520,
                  overflow: "auto",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "#",
                        "Код",
                        "Нэр",
                        "Категори",
                        "Үнэ (₮)",
                        "Салбарууд",
                        "Төлөв",
                        "Үйлдэл",
                      ].map((label) => (
                        <th
                          key={label}
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "#f9fafb",
                            textAlign:
                              label === "Үнэ (₮)" ? "right" : "left",
                            borderBottom: "1px solid #ddd",
                            padding: 8,
                            zIndex: 1,
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      Object.entries(servicesByCategory) as [
                        ServiceCategory,
                        Service[]
                      ][]
                    ).map(([category, list]) => {
                      if (!list.length) return null;
                      const isCollapsed = !!collapsedCategories[category];
                      const label =
                        SERVICE_CATEGORY_LABELS[category] || category;

                      return (
                        <React.Fragment key={category}>
                          {/* Category header row */}
                          <tr>
                            <td
                              colSpan={8}
                              style={{
                                background: "#f3f4f6",
                                borderBottom: "1px solid #e5e7eb",
                                padding: 8,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                              onClick={() => toggleCategory(category)}
                            >
                              {isCollapsed ? "▶" : "▼"} {label}{" "}
                              <span
                                style={{
                                  color: "#6b7280",
                                  fontWeight: 400,
                                }}
                              >
                                ({list.length})
                              </span>
                            </td>
                          </tr>

                          {!isCollapsed &&
                            list.map((s, index) => {
                              const isEditing = editingId === s.id;

                              if (isEditing) {
                                return (
                                  <tr key={s.id}>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                      }}
                                    >
                                      {(safePage - 1) * pageSize +
                                        index +
                                        1}
                                    </td>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                      }}
                                    >
                                      <input
                                        name="code"
                                        value={editForm.code}
                                        onChange={handleEditChange}
                                        style={{ width: "100%" }}
                                        placeholder="Код"
                                      />
                                    </td>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                      }}
                                    >
                                      <input
                                        name="name"
                                        value={editForm.name}
                                        onChange={handleEditChange}
                                        style={{ width: "100%" }}
                                        placeholder="Нэр"
                                      />
                                    </td>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                      }}
                                    >
                                      <select
                                        name="category"
                                        value={editForm.category}
                                        onChange={handleEditChange}
                                        style={{ width: "100%" }}
                                      >
                                        <option value="">
                                          Категори
                                        </option>
                                        {Object.entries(
                                          SERVICE_CATEGORY_LABELS
                                        ).map(([value, label]) => (
                                          <option
                                            key={value}
                                            value={value}
                                          >
                                            {label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                        textAlign: "right",
                                      }}
                                    >
                                      <input
                                        name="price"
                                        type="number"
                                        value={editForm.price}
                                        onChange={handleEditChange}
                                        style={{
                                          width: "100%",
                                          textAlign: "right",
                                        }}
                                        placeholder="Үнэ"
                                      />
                                    </td>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          flexWrap: "wrap",
                                          gap: 4,
                                        }}
                                      >
                                        {branches.map((b) => (
                                          <label
                                            key={b.id}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                              border:
                                                "1px solid #ddd",
                                              borderRadius: 4,
                                              padding: "2px 6px",
                                              fontSize: 12,
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={editForm.branchIds.includes(
                                                b.id
                                              )}
                                              onChange={() =>
                                                toggleEditBranch(b.id)
                                              }
                                            />
                                            {b.name}
                                          </label>
                                        ))}
                                      </div>
                                    </td>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                        textAlign: "center",
                                      }}
                                    >
                                      <label
                                        style={{ fontSize: 13 }}
                                      >
                                        <input
                                          type="checkbox"
                                          name="isActive"
                                          checked={
                                            editForm.isActive
                                          }
                                          onChange={handleEditChange}
                                        />{" "}
                                        Идэвхтэй
                                      </label>
                                    </td>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                        padding: 8,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => saveEdit(s.id)}
                                        style={{
                                          marginRight: 8,
                                          padding: "2px 6px",
                                          fontSize: 12,
                                        }}
                                      >
                                        Хадгалах
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        style={{
                                          padding: "2px 6px",
                                          fontSize: 12,
                                        }}
                                      >
                                        Цуцлах
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={s.id}>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                    }}
                                  >
                                    {(safePage - 1) * pageSize +
                                      index +
                                      1}
                                  </td>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                    }}
                                  >
                                    {s.code || "-"}
                                  </td>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                    }}
                                  >
                                    {s.name}
                                  </td>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                    }}
                                  >
                                    {SERVICE_CATEGORY_LABELS[
                                      s.category
                                    ] || s.category}
                                  </td>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                      textAlign: "right",
                                    }}
                                  >
                                    {s.price.toLocaleString(
                                      "mn-MN"
                                    )}
                                  </td>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                    }}
                                  >
                                    {s.serviceBranches?.length
                                      ? s.serviceBranches
                                          .map(
                                            (sb) =>
                                              sb.branch.name
                                          )
                                          .join(", ")
                                      : "-"}
                                  </td>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                      textAlign: "center",
                                    }}
                                  >
                                    {s.isActive
                                      ? "Идэвхтэй"
                                      : "Идэвхгүй"}
                                  </td>
                                  <td
                                    style={{
                                      borderBottom:
                                        "1px solid #f0f0f0",
                                      padding: 8,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => startEdit(s)}
                                      style={{
                                        marginRight: 8,
                                        padding: "2px 6px",
                                        fontSize: 12,
                                      }}
                                    >
                                      Засах
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteService(s.id)
                                      }
                                      style={{
                                        padding: "2px 6px",
                                        fontSize: 12,
                                        color: "#b91c1c",
                                        borderColor: "#b91c1c",
                                      }}
                                    >
                                      Устгах
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}

                    {filteredServices.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            textAlign: "center",
                            color: "#888",
                            padding: 12,
                          }}
                        >
                          Өгөгдөл алга
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredServices.length > pageSize && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    color: "#4b5563",
                  }}
                >
                  <span>
                    Нийт {filteredServices.length} үйлчилгээ — {safePage}/
                    {totalPages} хуудас
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        background:
                          safePage === 1 ? "#f9fafb" : "#ffffff",
                        color: "#111827",
                        cursor:
                          safePage === 1 ? "default" : "pointer",
                      }}
                    >
                      Өмнөх
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={safePage === totalPages}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        background:
                          safePage === totalPages ? "#f9fafb" : "#ffffff",
                        color: "#111827",
                        cursor:
                          safePage === totalPages
                            ? "default"
                            : "pointer",
                      }}
                    >
                      Дараах
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
