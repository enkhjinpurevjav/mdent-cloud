import React, { useEffect, useState } from "react";

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

  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "" as "" | ServiceCategory,
    description: "",
    code: "",
    branchIds: [] as number[],
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [bRes, sRes] = await Promise.all([
        fetch("/api/branches"),
        fetch("/api/services"),
      ]);

      const [bData, sData] = await Promise.all([bRes.json(), sRes.json()]);

      if (!bRes.ok || !Array.isArray(bData)) {
        throw new Error("branches load failed");
      }
      if (!sRes.ok || !Array.isArray(sData)) {
        throw new Error("services load failed");
      }

      setBranches(bData);
      setServices(sData);
    } catch (e) {
      console.error(e);
      setError("Өгөгдөл ачааллах үед алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const toggleBranch = (branchId: number) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) return;
    if (!form.branchIds.length) {
      alert("Ядаж нэг салбар сонгоно уу");
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
        setServices((prev) => [...prev, data]);
        setForm({
          name: "",
          price: "",
          category: "",
          description: "",
          code: "",
          branchIds: [],
          isActive: true,
        });
      } else {
        alert(data.error || "Үйлчилгээ хадгалах үед алдаа гарлаа");
      }
    } catch {
      alert("Сүлжээний алдаа");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Үйлчилгээний жагсаалт</h1>

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {/* Create service form */}
      <section style={{ marginTop: 24, marginBottom: 32 }}>
        <h2>Шинэ үйлчилгээ бүртгэх</h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: 8, maxWidth: 600 }}
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
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Тайлбар (сонголттой)"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />

          <input
            placeholder="Код (ж: S0001) - хоосон бол автоматаар үүснэ"
            value={form.code}
            onChange={(e) =>
              setForm((f) => ({ ...f, code: e.target.value }))
            }
          />

          <div style={{ marginTop: 4 }}>
            <div style={{ marginBottom: 4 }}>Салбарууд:</div>
            {branches.map((b) => (
              <label key={b.id} style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={form.branchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                />{" "}
                {b.name}
              </label>
            ))}
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
        </form>
      </section>

      {/* Services list */}
      <section>
        <h2>Бүртгэлтэй үйлчилгээ</h2>
        {services.length === 0 ? (
          <div style={{ color: "#777", marginTop: 8 }}>Үйлчилгээ алга</div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 12,
              fontSize: 14,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Код</th>
                <th style={{ textAlign: "left" }}>Нэр</th>
                <th style={{ textAlign: "left" }}>Категори</th>
                <th style={{ textAlign: "right" }}>Үнэ (₮)</th>
                <th style={{ textAlign: "left" }}>Салбарууд</th>
                <th style={{ textAlign: "center" }}>Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{s.code || "-"}</td>
                  <td>{s.name}</td>
                  <td>{SERVICE_CATEGORY_LABELS[s.category] || s.category}</td>
                  <td style={{ textAlign: "right" }}>
                    {s.price.toLocaleString("mn-MN")}
                  </td>
                  <td>
                    {s.serviceBranches?.length
                      ? s.serviceBranches.map((sb) => sb.branch.name).join(", ")
                      : "-"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {s.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
