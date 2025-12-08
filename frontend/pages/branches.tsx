import React, { useState, useEffect } from "react";

function BranchForm({ onSuccess }: { onSuccess: (b: any) => void }) {
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
        onSuccess(data);
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
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h2>Шинэ салбар бүртгэх</h2>
      <input
        name="name"
        placeholder="Салбарын нэр"
        value={form.name}
        onChange={handleChange}
        required
      />
      <input
        name="address"
        placeholder="Хаяг"
        value={form.address}
        onChange={handleChange}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "Бүртгэж байна..." : "Бүртгэх"}
      </button>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </form>
  );
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div style={{ padding: 24 }}>
      <h1>Эмнэлэг / Салбарууд</h1>

      <BranchForm
        onSuccess={(b) => {
          setBranches((bs) => [b, ...bs]);
          // optionally: loadBranches();
        }}
      />

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>Нэр</th>
              <th>Хаяг</th>
              <th>Үүссэн огноо</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.name}</td>
                <td>{b.address}</td>
                <td>
                  {b.createdAt
                    ? new Date(b.createdAt).toLocaleString("mn-MN")
                    : ""}
                </td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "#888" }}>
                  Өгөгдөл алга
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
