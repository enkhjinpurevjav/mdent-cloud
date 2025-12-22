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
  gender?: string | null;
  birthDate?: string | null;
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
    gender: "", // "" | "эр" | "эм"
    citizenship: "Монгол",
    emergencyPhone: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenderChange = (value: "" | "эр" | "эм") => {
    setForm((prev) => ({ ...prev, gender: value }));
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

    // Gender is optional but if present must be "эр" or "эм"
    if (form.gender && form.gender !== "эр" && form.gender !== "эм") {
      setError("Хүйс талбарт зөвхөн 'эр' эсвэл 'эм' утга сонгох боломжтой.");
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
        gender: form.gender || null, // optional, null when empty
        citizenship: form.citizenship?.trim() || null,
        emergencyPhone: form.emergencyPhone?.trim() || null,
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
          gender: "",
          citizenship: "Монгол",
          emergencyPhone: "",
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
        Шинэ үйлчлүүлэгч бүртгэх
      </h2>
      <p
        style={{
          margin: 0,
          marginBottom: 12,
          color: "#6b7280",
          fontSize: 12,
        }}
      >
        Зөвхөн нэр, утас, бүртгэсэн салбар заавал. Бусад мэдээллийг дараа нь
        профайлаас засварлаж болно.
      </p>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            marginTop: 4,
            marginBottom: 10,
            fontSize: 13,
          }}
        >
          <input
            name="ovog"
            placeholder="Овог (сонголттой)"
            value={form.ovog}
            onChange={handleChange}
            style={{
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />
          <input
            name="name"
            placeholder="Нэр (заавал)"
            value={form.name}
            onChange={handleChange}
            required
            style={{
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />
          <input
            name="regNo"
            placeholder="Регистрийн дугаар (сонголттой)"
            value={form.regNo}
            onChange={handleChange}
            style={{
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />
          <input
            name="phone"
            placeholder="Утасны дугаар (заавал)"
            value={form.phone}
            onChange={handleChange}
            required
            style={{
              borderRadius: 6,
              border: "1px solid #d1d5db",
              padding: "6px 8px",
            }}
          />

          {/* Gender */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Хүйс</label>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="gender"
                  value="эр"
                  checked={form.gender === "эр"}
                  onChange={() => handleGenderChange("эр")}
                />
                <span>Эр</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="gender"
                  value="эм"
                  checked={form.gender === "эм"}
                  onChange={() => handleGenderChange("эм")}
                />
                <span>Эм</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="gender"
                  value=""
                  checked={form.gender === ""}
                  onChange={() => handleGenderChange("")}
                />
                <span>Хоосон</span>
              </label>
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Хүйсийг дараа нь профайлаас өөрчилж болно. Хоосон орхиж бас
              болно.
            </span>
          </div>

          {/* Citizenship */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Иргэншил</label>
            <input
              name="citizenship"
              placeholder="Монгол"
              value={form.citizenship}
              onChange={handleChange}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Анхдагч утга нь &quot;Монгол&quot;. Шаардлагатай бол өөр улсын
              нэрийг оруулж болно.
            </span>
          </div>

          {/* Emergency phone */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Яаралтай үед холбоо барих утас
            </label>
            <input
              name="emergencyPhone"
              placeholder="Ж: 99112233"
              value={form.emergencyPhone}
              onChange={handleChange}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
          </div>

          {/* Branch selection */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Бүртгэсэн салбар (заавал)
            </label>
            <select
              name="branchId"
              value={form.branchId}
              onChange={handleChange}
              required
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            >
              <option value="">Салбар сонгох</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Optional manual book number */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Картын дугаар (сонголттой)
            </label>
            <input
              name="bookNumber"
              placeholder="Ж: 123456"
              value={form.bookNumber}
              onChange={handleChange}
              style={{
                borderRadius: 6,
                border: "1px solid #d1d5db",
                padding: "6px 8px",
              }}
            />
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Хоосон орхивол систем хамгийн сүүлийн дугаараас +1 автоматаар
              үүсгэнэ. 1-6 оронтой зөвхөн тоо байх ёстой.
            </span>
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
            <div
              style={{
                color: "#b91c1c",
                fontSize: 12,
                marginRight: "auto",
              }}
            >
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
    </section>
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

      const sortedPatients = [...pData].sort((a: Patient, b: Patient) => {
        const aNum = a.patientBook?.bookNumber
          ? parseInt(a.patientBook.bookNumber, 10)
          : 0;
        const bNum = b.patientBook?.bookNumber
          ? parseInt(b.patientBook.bookNumber, 10)
          : 0;

        if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
          return bNum - aNum;
        }

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

  const formatDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("mn-MN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // ---- Summary metrics ----

  const totalPatients = patients.length;
  const totalMale = patients.filter((p) => p.gender === "эр").length;
  const totalFemale = patients.filter((p) => p.gender === "эм").length;

  // helper to compute age from birthDate iso string
  const calcAge = (birthDate?: string | null): number | null => {
    if (!birthDate) return null;
    const d = new Date(birthDate);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
      age--;
    }
    return age;
  };

  // kids: age <= 17
  const totalKids = patients.filter((p) => {
    const age = calcAge((p as any).birthDate);
    return age !== null && age <= 17;
  }).length;

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "16px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "4px 0 8px" }}>
        Үйлчлүүлэгчийн бүртгэл
      </h1>
      <p style={{ color: "#555", marginBottom: 4 }}>
        Хурдан бүртгэх — зөвхөн нэр, утас, салбар заавал. Бусад мэдээллийг дараа
        нь нөхөж бөглөж болно.
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        <strong>Бүртгэсэн салбар</strong> нь тухайн үйлчлүүлэгчийн үндсэн /
        анх бүртгэгдсэн салбар юм. Үйлчлүүлэгч бусад салбарт очсон ч үзлэгийн
        салбар нь цаг авах үед тусад нь сонгогдоно.
      </p>

      {/* Summary cards row */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* 1. Total patients */}
        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background: "#e0ebff",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: "#1d4ed8",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            НИЙТ ҮЙЛЧЛҮҮЛЭГЧИД
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            {totalPatients}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>
            Системд бүртгэлтэй нийт үйлчлүүлэгчийн тоо
          </div>
        </div>

        {/* 2. Male */}
        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background: "#fef9c3",
            boxShadow: "0 4px 12px rgba(234, 179, 8, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: "#b45309",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            ЭРЭГТЭЙ ҮЙЛЧЛҮҮЛЭГЧИД
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            {totalMale}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>
            Нийт эрэгтэй үйлчлүүлэгчдийн тоо
          </div>
        </div>

        {/* 3. Female */}
        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background: "#fee2e2",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: "#b91c1c",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            ЭМЭГТЭЙ ҮЙЛЧЛҮҮЛЭГЧИД
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            {totalFemale}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>
            Нийт эмэгтэй үйлчлүүлэгчдийн тоо
          </div>
        </div>

        {/* 4. Kids (≤17) */}
        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background: "#dcfce7",
            boxShadow: "0 4px 12px rgba(34, 197, 94, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: "#15803d",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            ХҮҮХЭД
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            {totalKids}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>
            17 ба түүнээс доош насны хүүхдийн тоо
          </div>
        </div>
      </section>

      <PatientRegisterForm
        branches={branches}
        onSuccess={(p) => {
          setPatients((prev) =>
            [...prev, p].sort((a: Patient, b: Patient) => {
              const aNum = a.patientBook?.bookNumber
                ? parseInt(a.patientBook.bookNumber, 10)
                : 0;
              const bNum = b.patientBook?.bookNumber
                ? parseInt(b.patientBook.bookNumber, 10)
                : 0;

              if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
                return bNum - aNum;
              }

              const aName = `${a.ovog || ""} ${a.name || ""}`.toString();
              const bName = `${b.ovog || ""} ${b.name || ""}`.toString();
              return aName.localeCompare(bName, "mn");
            })
          );
        }}
      />

      {/* Search section */}
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
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 13,
          }}
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
              {["#", "Овог", "Нэр", "РД", "Утас", "Үүсгэсэн", "Бүртгэсэн салбар", "Үйлдэл"].map(
                (label) => (
                  <th
                    key={label}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #ddd",
                      padding: 8,
                    }}
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((p) => (
              <tr key={p.id}>
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
                  {formatDate(p.createdAt)}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {getBranchName(p.branchId)}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {p.patientBook?.bookNumber ? (
                    <a
                      href={`/patients/${encodeURIComponent(
                        p.patientBook.bookNumber
                      )}`}
                      style={{
                        fontSize: 12,
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        textDecoration: "none",
                        color: "#111827",
                        background: "#f9fafb",
                      }}
                    >
                      Дэлгэрэнгүй
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {filteredPatients.length === 0 && (
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
      )}
    </main>
  );
}
