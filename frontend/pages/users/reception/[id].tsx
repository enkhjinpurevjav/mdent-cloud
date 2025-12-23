import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

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
  branches?: Branch[];
  branch?: Branch | null;
  createdAt?: string;
};

export default function ReceptionProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState<Receptionist | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{
    name: string;
    ovog: string;
    regNo: string;
    phone: string;
    branchIds: number[];
  }>({
    name: "",
    ovog: "",
    regNo: "",
    phone: "",
    branchIds: [],
  });

  useEffect(() => {
    if (!id) return;

    const userId = Number(id);
    if (!userId || Number.isNaN(userId)) {
      setError("Invalid reception id");
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        // load branches
        const resBranches = await fetch("/api/branches");
        const dataBranches = await resBranches.json().catch(() => []);
        if (resBranches.ok && Array.isArray(dataBranches)) {
          setBranches(dataBranches);
        }

        // load user
        const resUser = await fetch(`/api/users/${userId}`);
        const dataUser = await resUser.json().catch(() => null);

        if (!resUser.ok || !dataUser || !dataUser.id) {
          setError((dataUser && dataUser.error) || "Ресепшн олдсонгүй");
          setUser(null);
          setLoading(false);
          return;
        }

        const u = dataUser as Receptionist;
        setUser(u);

        const currentBranches =
          Array.isArray(u.branches) && u.branches.length > 0
            ? u.branches.map((b) => b.id)
            : u.branch
            ? [u.branch.id]
            : [];

        setForm({
          name: u.name || "",
          ovog: u.ovog || "",
          regNo: u.regNo || "",
          phone: u.phone || "",
          branchIds: currentBranches,
        });
      } catch {
        setError("Сүлжээгээ шалгана уу");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const payload: any = {
        name: form.name || null,
        ovog: form.ovog || null,
        regNo: form.regNo || null,
        phone: form.phone || null,
      };

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.id) {
        setError((data && data.error) || "Хадгалах үед алдаа гарлаа");
        setSaving(false);
        return;
      }

      // update branches
      const resBranches = await fetch(`/api/users/${user.id}/branches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: form.branchIds }),
      });
      const branchesData = await resBranches.json().catch(() => null);

      if (!resBranches.ok) {
        setError(
          (branchesData && branchesData.error) ||
            "Салбар хадгалах үед алдаа гарлаа"
        );
        setSaving(false);
        return;
      }

      const updatedBranches =
        branchesData && Array.isArray(branchesData.branches)
          ? branchesData.branches
          : data.branches || [];

      setUser({
        ...data,
        branches: updatedBranches,
      });
    } catch {
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main
        style={{
          maxWidth: 800,
          margin: "40px auto",
          padding: 24,
          fontFamily: "sans-serif",
        }}
      >
        Ачааллаж байна...
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          maxWidth: 800,
          margin: "40px auto",
          padding: 24,
          fontFamily: "sans-serif",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/users/reception")}
          style={{
            marginBottom: 16,
            padding: "4px 8px",
            fontSize: 13,
            borderRadius: 4,
            border: "1px solid #ddd",
            background: "#f9fafb",
          }}
        >
          ← Буцах
        </button>
        <div style={{ color: "red" }}>{error}</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        style={{
          maxWidth: 800,
          margin: "40px auto",
          padding: 24,
          fontFamily: "sans-serif",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/users/reception")}
          style={{
            marginBottom: 16,
            padding: "4px 8px",
            fontSize: 13,
            borderRadius: 4,
            border: "1px solid #ddd",
            background: "#f9fafb",
          }}
        >
          ← Буцах
        </button>
        Ресепшн олдсонгүй.
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => router.push("/users/reception")}
        style={{
          marginBottom: 16,
          padding: "4px 8px",
          fontSize: 13,
          borderRadius: 4,
          border: "1px solid #ddd",
          background: "#f9fafb",
        }}
      >
        ← Ресепшний жагсаалт руу буцах
      </button>

      <h1>Ресепшний профайл</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Ресепшн ажилтны үндсэн мэдээлэл ба салбар хуваарилалт.
      </p>

      <form
        onSubmit={handleSave}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Овог
          </label>
          <input
            name="ovog"
            value={form.ovog}
            onChange={handleChange}
            style={{ width: "100%", padding: 6, fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Нэр
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            style={{ width: "100%", padding: 6, fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            РД
          </label>
          <input
            name="regNo"
            value={form.regNo}
            onChange={handleChange}
            style={{ width: "100%", padding: 6, fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Утас
          </label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            style={{ width: "100%", padding: 6, fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            И-мэйл
          </label>
          <input
            disabled
            value={user.email}
            style={{
              width: "100%",
              padding: 6,
              fontSize: 14,
              background: "#f9fafb",
            }}
          />
        </div>
      </form>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Салбар хуваарилалт</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
          Энэ ресепшн аль салбарт ажиллахыг сонгоно уу. Олон салбар сонгож
          болно.
        </p>
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
      </section>

      {error && (
        <div style={{ color: "red", marginBottom: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "6px 12px",
          fontSize: 14,
          borderRadius: 4,
          border: "1px solid #2563eb",
          background: "#2563eb",
          color: "white",
        }}
      >
        {saving ? "Хадгалж байна..." : "Хадгалах"}
      </button>
    </main>
  );
}
