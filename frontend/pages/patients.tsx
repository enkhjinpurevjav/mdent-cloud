import React, { useState, useEffect } from "react";

type Branch = {
  id: number;
  name: string;
};

type Patient = {
  id: number;
  ovog?: string | null;
  name: string;
  regNo?: string | null;
  phone?: string | null;
  branchId: number;
  branch?: Branch;
  patientBook?: { bookNumber: string } | null;
  createdAt?: string;
};

function PatientRegisterForm({
  branches,
  onSuccess,
}: {
  branches: Branch[];
  onSuccess: (p: Patient) => void;
}) {
  const [form, setForm] = useState({
    ovog: "",
    name: "",
    regNo: "",
    phone: "",
    branchId: "",
    bookNumber: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Minimal required: name, phone, branchId
    if (!form.name || !form.phone) {
      setError("Нэр болон утас заавал бөглөнө үү.");
      return;
    }
    if (!form.branchId) {
      setError("Салбар сонгоно уу.");
      return;
    }

    // Optional client-side validation: card number if filled
    if (form.bookNumber && !/^\d{1,6}$/.test(form.bookNumber)) {
      setError("Картын дугаар нь 1-6 оронтой зөвхөн тоо байх ёстой.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ovog: form.ovog || null,
        name: form.name,
        regNo: form.regNo || null,
        phone: form.phone,
        branchId: Number(form.branchId),
        bookNumber: form.bookNumber || "",
      };

      const res = await fetch("/api/patients", {
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

      if (res.ok) {
        onSuccess(data);
        setForm({
          ovog: "",
          name: "",
          regNo: "",
          phone: "",
          branchId: "",
          bookNumber: "",
        });
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
      <h2>Шинэ үйлчлүүлэгч бүртгэх</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <input
          name="ovog"
          placeholder="Овог (сонголттой)"
          value={form.ovog}
          onChange={handleChange}
        />
        <input
          name="name"
          placeholder="Нэр (заавал)"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          name="regNo"
          placeholder="Регистрийн дугаар (сонголттой)"
          value={form.regNo}
          onChange={handleChange}
        />
        <input
          name="phone"
          placeholder="Утасны дугаар (заавал)"
          value={form.phone}
          onChange={handleChange}
          required
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Бүртгэсэн салбар (заавал)
          </label>
          <select
            name="branchId"
            value={form.branchId}
            onChange={handleChange}
            required
          >
            <option value="">Салбар сонгох</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Картын дугаар (сонголттой)
          </label>
          <input
            name="bookNumber"
            placeholder="Ж: 123456"
            value={form.bookNumber}
            onChange={handleChange}
          />
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            Хоосон орхивол систем хамгийн сүүлийн дугаараас +1 автоматаар
            үүсгэнэ. 1-6 оронтой зөвхөн тоо байх ёстой.
          </span>
        </div>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Бүртгэж байна..." : "Бүртгэх"}
      </button>

      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </form>
  );
}

export default function PatientsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [bRes, pRes] = await Promise.all([
        fetch("/api/branches"),
        fetch("/api/patients"),
      ]);

      let bData: any = null;
      let pData: any = null;
      try {
        bData = await bRes.json();
      } catch {
        bData = null;
      }
      try {
        pData = await pRes.json();
      } catch {
        pData = null;
      }

      if (!bRes.ok || !Array.isArray(bData)) {
        throw new Error("branches load failed");
      }
      if (!pRes.ok || !Array.isArray(pData)) {
        throw new Error("patients load failed");
      }

      setBranches(bData);

      const sortedPatients = [...pData].sort((a, b) => {
        const aName = `${a.ovog || ""} ${a.name || ""}`.toString();
        const bName = `${b.ovog || ""} ${b.name || ""}`.toString();
        return aName.localeCompare(bName, "mn");
      });
      setPatients(sortedPatients);
    } catch (e) {
      console.error(e);
      setError("Өгөгдөл ачааллах үед алдаа гарлаа");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPatients = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = `${p.ovog || ""} ${p.name || ""}`.toLowerCase();
    const regNo = (p.regNo || "").toLowerCase();
    const phone = (p.phone || "").toLowerCase();
    return name.includes(q) || regNo.includes(q) || phone.includes(q);
  });

  const getBranchName = (branchId: number) => {
    const b = branches.find((br) => br.id === branchId);
    return b ? b.name : branchId;
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
      <h1>Үйлчлүүлэгчийн бүртгэл</h1>
      <p style={{ color: "#555", marginBottom: 4 }}>
        Хурдан бүртгэх — зөвхөн нэр, утас, салбар заавал. Бусад мэдээллийг
        дараа нь нөхөж бөглөж болно.
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        <strong>Бүртгэсэн салбар</strong> нь тухайн үйлчлүүлэгчийн үндсэн /
        анх бүртгэгдсэн салбар юм. Үйлчлүүлэгч бусад салбарт очсон ч үзлэгийн
        салбар нь цаг авах үед тусад нь сонгогдоно.
      </p>

      <PatientRegisterForm
        branches={branches}
        onSuccess={(p) => {
          setPatients((prev) =>
            [...prev, p].sort((a, b) =>
              `${a.ovog || ""} ${a.name || ""}`
                .toString()
                .localeCompare(
                  `${b.ovog || ""} ${b.name || ""}`.toString(),
                  "mn"
                )
            )
          );
        }}
      />

      <section
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Хайлт</h2>
        <input
          placeholder="Нэр, РД, утасгаар хайх"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
      </section>

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
                #
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
                  borderBottom: "1px solid #ddd",
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
                Картын дугаар
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Бүртгэсэн салбар
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((p, index) => (
              <tr key={p.id}>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {index + 1}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {p.ovog || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {p.name || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {p.regNo || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {p.phone || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {p.patientBook?.bookNumber || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {getBranchName(p.branchId)}
                </td>
              </tr>
            ))}
            {filteredPatients.length === 0 && (
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
