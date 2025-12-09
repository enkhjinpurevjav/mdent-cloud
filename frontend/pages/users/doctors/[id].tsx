import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type Doctor = {
  id: number;
  email: string;
  name?: string;
  ovog?: string | null;
  role: string;
  branchId?: number | null;
  regNo?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null; // ISO string
  signatureImagePath?: string | null;
  stampImagePath?: string | null;
  idPhotoPath?: string | null;
};

type Branch = {
  id: number;
  name: string;
};

export default function DoctorProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    ovog: "",
    email: "",
    branchId: "",
    regNo: "",
    licenseNumber: "",
    licenseExpiryDate: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // Load branches + doctor
  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // load branches
        const bRes = await fetch("/api/branches");
        const bData = await bRes.json();
        if (bRes.ok && Array.isArray(bData)) {
          setBranches(bData);
        }

        // load doctor
        const dRes = await fetch(`/api/users/${id}`);
        const dData = await dRes.json();

        if (!dRes.ok) {
          setError(dData?.error || "Эмчийн мэдээллийг ачааллаж чадсангүй");
          setLoading(false);
          return;
        }

        setDoctor(dData);

        setForm({
          name: dData.name || "",
          ovog: dData.ovog || "",
          email: dData.email || "",
          branchId: dData.branchId ? String(dData.branchId) : "",
          regNo: dData.regNo || "",
          licenseNumber: dData.licenseNumber || "",
          licenseExpiryDate: dData.licenseExpiryDate
            ? dData.licenseExpiryDate.slice(0, 10)
            : "",
        });

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Сүлжээгээ шалгана уу");
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name || null,
        ovog: form.ovog || null,
        email: form.email || null,
        branchId: form.branchId ? Number(form.branchId) : null,
        regNo: form.regNo || null,
        licenseNumber: form.licenseNumber || null,
        licenseExpiryDate: form.licenseExpiryDate || null, // yyyy-mm-dd
      };

      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Хадгалах үед алдаа гарлаа");
        setSaving(false);
        return;
      }

      setDoctor(data);
    } catch (err) {
      console.error(err);
      setError("Сүлжээгээ шалгана уу");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div>Ачааллаж байна...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Эмчийн мэдээлэл</h1>
        <div style={{ color: "red", marginTop: 8 }}>{error}</div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Эмч олдсонгүй</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <button
        onClick={() => router.back()}
        style={{
          marginBottom: 16,
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid #ddd",
          cursor: "pointer",
        }}
      >
        &larr; Буцах
      </button>

      <h1>Эмчийн профайл: {doctor.name || doctor.email}</h1>

      <form
        onSubmit={handleSave}
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 500,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Нэр
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Нэр"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Овог
          <input
            name="ovog"
            value={form.ovog}
            onChange={handleChange}
            placeholder="Овог"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          И-мэйл
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="И-мэйл"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Салбар
          <select
            name="branchId"
            value={form.branchId}
            onChange={handleChange}
          >
            <option value="">Сонгохгүй</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          РД (regNo)
          <input
            name="regNo"
            value={form.regNo}
            onChange={handleChange}
            placeholder="РД"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Лицензийн дугаар
          <input
            name="licenseNumber"
            value={form.licenseNumber}
            onChange={handleChange}
            placeholder="Лицензийн дугаар"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Лиценз дуусах өдөр
          <input
            name="licenseExpiryDate"
            type="date"
            value={form.licenseExpiryDate}
            onChange={handleChange}
          />
        </label>

        {/* Future: file upload fields for signatureImagePath, stampImagePath, idPhotoPath */}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            borderRadius: 4,
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {saving ? "Хадгалж байна..." : "Хадгалах"}
        </button>

        {error && (
          <div style={{ color: "red", marginTop: 8 }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
