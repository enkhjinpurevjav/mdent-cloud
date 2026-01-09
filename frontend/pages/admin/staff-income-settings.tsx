import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type DoctorConfig = {
  doctorId: number;
  ovog: string;
  name: string;
  email: string;
  orthoPct: number;
  defectPct: number;
  surgeryPct: number;
  generalPct: number;
};

type StaffIncomeSettings = {
  whiteningDeductAmountMnt: number;
  doctors: DoctorConfig[];
};

export default function StaffIncomeSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [whiteningDeductAmountMnt, setWhiteningDeductAmountMnt] = useState<number>(0);
  const [doctors, setDoctors] = useState<DoctorConfig[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/staff-income-settings");
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Failed to load staff income settings");
      }

      const data: StaffIncomeSettings = await res.json();
      setWhiteningDeductAmountMnt(data.whiteningDeductAmountMnt || 0);
      setDoctors(data.doctors || []);
    } catch (err: any) {
      console.error("Failed to load staff income settings:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      // Validate whitening deduct amount
      if (isNaN(whiteningDeductAmountMnt) || whiteningDeductAmountMnt < 0) {
        throw new Error("Home bleaching материалын хасалт буруу байна");
      }

      // Validate doctor configs
      for (const doc of doctors) {
        if (isNaN(doc.orthoPct) || doc.orthoPct < 0) {
          throw new Error(`${doc.ovog} ${doc.name}: Гажиг заслын % буруу байна`);
        }
        if (isNaN(doc.defectPct) || doc.defectPct < 0) {
          throw new Error(`${doc.ovog} ${doc.name}: Согог засалын % буруу байна`);
        }
        if (isNaN(doc.surgeryPct) || doc.surgeryPct < 0) {
          throw new Error(`${doc.ovog} ${doc.name}: Мэс засалын % буруу байна`);
        }
        if (isNaN(doc.generalPct) || doc.generalPct < 0) {
          throw new Error(`${doc.ovog} ${doc.name}: Бусад эмчилгээний % буруу байна`);
        }
      }

      const payload = {
        whiteningDeductAmountMnt,
        doctors: doctors.map((d) => ({
          doctorId: d.doctorId,
          orthoPct: Number(d.orthoPct),
          defectPct: Number(d.defectPct),
          surgeryPct: Number(d.surgeryPct),
          generalPct: Number(d.generalPct),
        })),
      };

      const res = await fetch("/api/admin/staff-income-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Failed to save staff income settings");
      }

      setSuccess("Тохиргоо амжилттай хадгалагдлаа");
      setTimeout(() => setSuccess(""), 3000);
      
      // Reload to confirm saved values
      await loadData();
    } catch (err: any) {
      console.error("Failed to save staff income settings:", err);
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDoctorChange = (doctorId: number, field: keyof DoctorConfig, value: string) => {
    setDoctors((prev) =>
      prev.map((doc) =>
        doc.doctorId === doctorId
          ? { ...doc, [field]: value === "" ? 0 : Number(value) }
          : doc
      )
    );
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 1200, margin: "40px auto", padding: 24 }}>
        <p>Ачаалж байна...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Ажилчдын хувийн тохиргоо</h1>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            color: "#15803d",
          }}
        >
          {success}
        </div>
      )}

      {/* Global Settings Section */}
      <section
        style={{
          marginBottom: 32,
          padding: 24,
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Нийтлэг тохиргоо</h2>
        
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="whiteningDeduct"
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Home bleaching (код 151) материалын хасалт (₮)
          </label>
          <input
            id="whiteningDeduct"
            type="number"
            min="0"
            step="0.01"
            value={whiteningDeductAmountMnt}
            onChange={(e) => setWhiteningDeductAmountMnt(Number(e.target.value))}
            style={{
              width: "100%",
              maxWidth: 300,
              padding: "8px 12px",
              fontSize: 14,
              border: "1px solid #d1d5db",
              borderRadius: 6,
            }}
          />
        </div>

        {/* Read-only imaging commission note */}
        <div
          style={{
            padding: 12,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            fontSize: 14,
            color: "#6b7280",
          }}
        >
          <strong>Зураг (IMAGING):</strong> Эмч 5% (fixed)
        </div>
      </section>

      {/* Doctors Commission Table */}
      <section
        style={{
          padding: 24,
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Эмчийн урамшууллын хувь</h2>

        {doctors.length === 0 ? (
          <p style={{ fontSize: 14, color: "#6b7280" }}>Эмч олдсонгүй.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>
                    Эмч
                  </th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>
                    И-мэйл
                  </th>
                  <th style={{ padding: 12, textAlign: "center", fontWeight: 600 }}>
                    Гажиг заслын<br />эмчилгээ (%)
                  </th>
                  <th style={{ padding: 12, textAlign: "center", fontWeight: 600 }}>
                    Согог засал (%)
                  </th>
                  <th style={{ padding: 12, textAlign: "center", fontWeight: 600 }}>
                    Мэс засал (%)
                  </th>
                  <th style={{ padding: 12, textAlign: "center", fontWeight: 600 }}>
                    Бусад эмчилгээ (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr
                    key={doctor.doctorId}
                    style={{ borderBottom: "1px solid #e5e7eb" }}
                  >
                    <td style={{ padding: 12 }}>
                      {doctor.ovog} {doctor.name}
                    </td>
                    <td style={{ padding: 12, color: "#6b7280" }}>
                      {doctor.email}
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={doctor.orthoPct}
                        onChange={(e) =>
                          handleDoctorChange(doctor.doctorId, "orthoPct", e.target.value)
                        }
                        style={{
                          width: 80,
                          padding: "6px 8px",
                          fontSize: 14,
                          border: "1px solid #d1d5db",
                          borderRadius: 4,
                          textAlign: "center",
                        }}
                      />
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={doctor.defectPct}
                        onChange={(e) =>
                          handleDoctorChange(doctor.doctorId, "defectPct", e.target.value)
                        }
                        style={{
                          width: 80,
                          padding: "6px 8px",
                          fontSize: 14,
                          border: "1px solid #d1d5db",
                          borderRadius: 4,
                          textAlign: "center",
                        }}
                      />
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={doctor.surgeryPct}
                        onChange={(e) =>
                          handleDoctorChange(doctor.doctorId, "surgeryPct", e.target.value)
                        }
                        style={{
                          width: 80,
                          padding: "6px 8px",
                          fontSize: 14,
                          border: "1px solid #d1d5db",
                          borderRadius: 4,
                          textAlign: "center",
                        }}
                      />
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={doctor.generalPct}
                        onChange={(e) =>
                          handleDoctorChange(doctor.doctorId, "generalPct", e.target.value)
                        }
                        style={{
                          width: 80,
                          padding: "6px 8px",
                          fontSize: 14,
                          border: "1px solid #d1d5db",
                          borderRadius: 4,
                          textAlign: "center",
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Save All Button */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              borderRadius: 6,
              background: saving ? "#d1d5db" : "#2563eb",
              color: "#ffffff",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Хадгалж байна..." : "Бүгдийг хадгалах"}
          </button>
        </div>
      </section>
    </main>
  );
}
