import React, { useEffect, useState } from "react";
import UsersTabs from "../../components/UsersTabs";

type Branch = {
  id: number;
  name: string;
};

type Receptionist = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  regNo?: string | null;
  phone?: string | null;
  branchId?: number | null;
  branch?: Branch | null;
  branches?: Branch[];
  createdAt?: string;
};

function ReceptionForm({
  branches,
  onSuccess,
}: {
  branches: Branch[];
  onSuccess: (u: Receptionist) => void;
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    ovog: "",
    regNo: "",
    phone: "",
    branchIds: [] as number[],
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBranchToggle = (branchId: number) => {
    setForm((prev) => {
      const exists = prev.branchIds.includes(branchId);
      return {
        ...prev,
        branchIds: exists
          ? prev.branchIds.filter((id) => id !== branchId)
          : [...prev.branchIds, branchId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const primaryBranchId =
        form.branchIds.length > 0 ? form.branchIds[0] : undefined;

      const payload: any = {
        email: form.email,
        password: form.password,
        name: form.name || undefined,
        ovog: form.ovog || undefined,
        role: "receptionist",
        branchId: primaryBranchId,
        phone: form.phone || undefined,
      };

      if (form.regNo.trim()) {
        payload.regNo = form.regNo.trim();
      }

      // 1) create receptionist
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.id) {
        setError((data && data.error) || "Алдаа гарлаа");
        setSubmitting(false);
        return;
      }

      const createdUser = data as Receptionist;

      // 2) assign multiple branches via /api/users/:id/branches
      if (form.branchIds.length > 0) {
        try {
          const resBranches = await fetch(
            `/api/users/${createdUser.id}/branches`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ branchIds: form.branchIds }),
            }
          );
          let branchesData: any = null;
          try {
            branchesData = await resBranches.json();
          } catch {
            branchesData = null;
          }

          if (
            resBranches.ok &&
            branchesData &&
            Array.isArray(branchesData.branches)
          ) {
            createdUser.branches = branchesData.branches;
          }
        } catch (e) {
          console.error("Failed to assign multiple branches", e);
        }
      }

      onSuccess(createdUser);

      setForm({
        email: "",
        password: "",
        name: "",
        ovog: "",
        regNo: "",
        phone: "",
        branchIds: [],
      });
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h2>Шинэ ресепшн бүртгэх</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <input
          name="ovog"
          placeholder="Овог"
          value={form.ovog}
          onChange={handleChange}
          required
        />
        <input
          name="name"
          placeholder="Нэр"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          name="regNo"
          placeholder="РД"
          value={form.regNo}
          onChange={handleChange}
        />
        <input
          name="phone"
          placeholder="Утас"
          value={form.phone}
          onChange={handleChange}
        />
        <input
          name="email"
          type="email"
          placeholder="И-мэйл"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Нууц үг"
          value={form.password}
          onChange={handleChange}
          required
        />
      </div>

      {/* Multi-branch selection (same style as doctor registration) */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ marginBottom: 4, fontWeight: 500 }}>Салбар сонгох</div>
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
                onChange={() => handleBranchToggle(b.id)}
              />
              {b.name}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Бүртгэж байна..." : "Бүртгэх"}
      </button>

      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </form>
  );
}

export default function ReceptionPage() {
  const [users, setUsers] = useState<Receptionist[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    ovog: string;
    regNo: string;
    phone: string;
    branchId: number | null;
  }>({
    name: "",
    ovog: "",
    regNo: "",
    phone: "",
    branchId: null,
  });

  const loadBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBranches(data);
      }
    } catch {
      // ignore; main error handling below
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users?role=receptionist");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && data.error) || "Алдаа гарлаа");
      }

      setUsers(
        [...data].sort((a, b) => {
          if (a.id < b.id) return -1;
          if (a.id > b.id) return 1;
          return 0;
        })
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Сүлжээгээ шалгана уу");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
    loadUsers();
  }, []);

  const startEdit = (u: Receptionist) => {
    setEditingId(u.id);
    setEditForm({
      name: u.name || "",
      ovog: u.ovog || "",
      regNo: u.regNo || "",
      phone: u.phone || "",
      branchId: u.branchId ?? (u.branch ? u.branch.id : null),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]:
        name === "branchId"
          ? value
            ? Number(value)
            : null
          : value,
    }));
  };

  const saveEdit = async (id: number) => {
    try {
      const payload: any = {
        name: editForm.name || null,
        ovog: editForm.ovog || null,
        regNo: editForm.regNo || null,
        phone: editForm.phone || null,
        branchId: editForm.branchId || null,
      };

      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.id) {
        alert((data && data.error) || "Хадгалах үед алдаа гарлаа");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                name: data.name,
                ovog: data.ovog,
                regNo: data.regNo,
                phone: data.phone,
                branchId: data.branchId,
                branch: data.branch,
              }
            : u
        )
      );
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  const deleteUser = async (id: number) => {
    const ok = window.confirm(
      "Та энэхүү ресепшн ажилтныг устгахдаа итгэлтэй байна уу?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
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

      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
      alert("Сүлжээгээ шалгана уу");
    }
  };

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Ресепшн</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Ресепшн ажилчдыг бүртгэх, салбарт хуваарилах, жагсаалтаар харах.
      </p>

      <UsersTabs />

      <ReceptionForm
        branches={branches}
        onSuccess={(u) => {
          setUsers((prev) => [u, ...prev]);
        }}
      />

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 8,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                ID
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Овог
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Нэр
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                РД
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid "#ddd",
                  padding: 8,
                }}
              >
                Утас
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Салбар
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Үйлдэл
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isEditing = editingId === u.id;

              if (isEditing) {
                return (
                  <tr key={u.id}>
                    <td
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                        padding: 8,
                      }}
                    >
                      {u.id}
                    </td>
                    <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                      <input
                        name="ovog"
                        value={editForm.ovog}
                        onChange={handleEditChange}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                      <input
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                      <input
                        name="regNo"
                        value={editForm.regNo}
                        onChange={handleEditChange}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                      <input
                        name="phone"
                        value={editForm.phone}
                        onChange={handleEditChange}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                      <select
                        name="branchId"
                        value={editForm.branchId ?? ""}
                        onChange={handleEditChange}
                        style={{ width: "100%" }}
                      >
                        <option value="">-</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
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
                        onClick={() => saveEdit(u.id)}
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
                        style={{ padding: "2px 6px", fontSize: 12 }}
                      >
                        Цуцлах
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={u.id}>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 8,
                    }}
                  >
                    {u.id}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 8,
                    }}
                  >
                    {u.ovog || "-"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 8,
                    }}
                  >
                    {u.name || "-"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 8,
                    }}
                  >
                    {u.regNo || "-"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 8,
                    }}
                  >
                    {u.phone || "-"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: 8,
                    }}
                  >
                    {Array.isArray(u.branches) && u.branches.length > 0
                      ? u.branches.map((b) => b.name).join(", ")
                      : u.branch
                      ? u.branch.name
                      : "-"}
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
                      onClick={() => startEdit(u)}
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
                      onClick={() => deleteUser(u.id)}
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
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={7}
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
      )}
    </main>
  );
}
