import React, { useEffect, useMemo, useState } from "react";

type Branch = {
  id: number;
  name: string;
};

type ServiceCategory =
  | "GENERAL_DENTISTRY"
  | "IMPLANTS"
  | "ORTHODONTICS"
  | "COSMETIC_DENTISTRY"
  | "CHILDRENS";

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
  GENERAL_DENTISTRY: "Ерөнхий шүдний эмчилгээ",
  IMPLANTS: "Имплант",
  ORTHODONTICS: "Шүдний гажиг засал",
  COSMETIC_DENTISTRY: "Гоо сайхны шүдний эмчилгээ",
  CHILDRENS: "Хүүхдийн шүдний эмчилгээ",
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
  const pageSize = 20;

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
        code: form.code || undefined, // optional manual code
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

  // -----------------------
  // Derived lists (filter + search + pagination + grouping)
  // -----------------------
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
      GENERAL_DENTISTRY: [],
      IMPLANTS: [],
      ORTHODONTICS: [],
      COSMETIC_DENTISTRY: [],
      CHILDRENS: [],
    };
    pagedServices.forEach((s) => {
      groups[s.category].push(s);
    });
    return groups;
  }, [pagedServices]);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Үйлчилгээ</h1>
      <p style={{ color: "#555", marginBottom: 4 }}>
        Үйлчилгээг бүртгэх — зөвхөн нэр, үнэ, категори, салбар заавал. Бусад
        мэдээллийг дараа нь нөхөж бөглөж болно.
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        <strong>Салбарууд</strong> нь тухайн үйлчилгээг аль салбарт санал
        болгохыг заана. Үнийн дүн, категори нь бүх салбаруудад нийтлэг байна.
      </p>

      {/* Create service form */}
      <section style={{ marginTop: 16, marginBottom: 32 }}>
        <form onSubmit={handleCreateSubmit} style={{ marginBottom: 8 }}>
          <h2>Шинэ үйлчилгээ бүртгэх</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 8,
              maxWidth: 800,
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            <input
              placeholder="Үйлчилгээний нэр"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
            <input
              type="number"
              placeholder="Үнэ (₮)"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
              required
            />
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as ServiceCategory,
                }))
              }
              required
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
            <input
              placeholder="Код (ж: S0001) - хоосон бол автоматаар үүснэ"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <textarea
              placeholder="Тайлбар (сонголттой)"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              style={{ gridColumn: "1 / -1" }}
            />

            <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>Салбарууд</div>
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
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      padding: "4px 8px",
                      fontSize: 13,
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

            <label style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />{" "}
              Идэвхтэй
            </label>

            <button type="submit" disabled={submitting}>
              {submitting ? "Хадгалж байна..." : "Бүртгэх"}
            </button>
          </div>

          {formError && (
            <div style={{ color: "red", marginTop: 4 }}>{formError}</div>
          )}
        </form>
      </section>

      {/* Filters + search (match Patients style) */}
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
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Категори
            <select
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(
                  e.target.value
                    ? (e.target.value as ServiceCategory)
                    : ""
                )
              }
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
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Салбар
            <select
              value={filterBranchId === "" ? "" : String(filterBranchId)}
              onChange={(e) =>
                setFilterBranchId(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
            >
              <option value="">Бүгд</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={filterOnlyActive}
              onChange={(e) => setFilterOnlyActive(e.target.checked)}
            />
            Зөвхөн идэвхтэй
          </label>
        </div>

        {/* Search like patients page */}
        <input
          placeholder="Нэр, кодоор хайх"
          value={filterSearch}
          onChange={(e) => {
            setFilterSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: "100%", padding: 8 }}
        />
      </section>

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {/* Services list */}
      {!loading && !error && (
        <section>
          <h2>Бүртгэлтэй үйлчилгээ</h2>
          {editError && (
            <div style={{ color: "red", marginTop: 4, marginBottom: 4 }}>
              {editError}
            </div>
          )}
          {filteredServices.length === 0 ? (
            <div style={{ color: "#777", marginTop: 8 }}>Үйлчилгээ алга</div>
          ) : (
            <>
              <div style={{ maxHeight: 500, overflow: "auto", marginTop: 8 }}>
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
                      const isCollapsed =
                        !!collapsedCategories[category as ServiceCategory];
                      const label =
                        SERVICE_CATEGORY_LABELS[category as ServiceCategory] ||
                        category;

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
                              onClick={() =>
                                toggleCategory(category as ServiceCategory)
                              }
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
                                      {/* index within page, not global */}
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
                                        ).map(
                                          ([value, label]) => (
                                            <option
                                              key={value}
                                              value={value}
                                            >
                                              {label}
                                            </option>
                                          )
                                        )}
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
                                                toggleEditBranch(
                                                  b.id
                                                )
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

              {/* Pagination (Patients-like simple controls) */}
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
                    Нийт {filteredServices.length} үйлчилгээ —{" "}
                    {safePage}/{totalPages} хуудас
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.max(1, p - 1))
                      }
                      disabled={safePage === 1}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        background:
                          safePage === 1 ? "#f9fafb" : "white",
                        color: "#111827",
                        cursor:
                          safePage === 1 ? "default" : "pointer",
                        fontSize: 12,
                      }}
                    >
                      Өмнөх
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) =>
                          Math.min(totalPages, p + 1)
                        )
                      }
                      disabled={safePage === totalPages}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        background:
                          safePage === totalPages
                            ? "#f9fafb"
                            : "white",
                        color: "#111827",
                        cursor:
                          safePage === totalPages
                            ? "default"
                            : "pointer",
                        fontSize: 12,
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
