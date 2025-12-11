import React, { useEffect, useState } from "react";
import UsersTabs from "../../components/UsersTabs";

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  branchId?: number | null;
  branch?: Branch | null;
  branches?: Branch[]; // NEW: all assigned branches
  regNo?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  createdAt?: string;
};

type Branch = {
  id: number;
  name: string;
};

type Doctor = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  branchId?: number | null;
  branch?: Branch | null;
  branches?: Branch[]; // NEW: all assigned branches
  regNo?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  createdAt?: string;
};

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBranches(data);
      }
    } catch {
      // ignore here, main error handling is in doctors load
    }
  };

  const loadDoctors = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users?role=doctor");
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && Array.isArray(data)) {
        setDoctors(data);
      } else {
        setError(
          (data && data.error) || "Эмч нарын жагсаалтыг ачааллаж чадсангүй"
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
    loadDoctors();
  }, []);

  return (
    <main
      style={{
        maxWidth: 700,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Эмч нар</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Эмч нарыг бүртгэх, салбарт хуваарилах, профайлыг харах.
      </p>

      <UsersTabs />

      <DoctorForm
        branches={branches}
        onSuccess={(d) => {
          setDoctors((ds) => [d, ...ds]);
        }}
      />

      {loading && <div>Ачааллаж байна...</div>}
      {!loading && error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 20,
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
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                И-мэйл
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
                Бүртгэгдсэн
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #ddd",
                  padding: 8,
                }}
              >
                Дэлгэрэнгүй
              </th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id}>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.id}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.ovog || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.name || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.regNo || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.email}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.branch ? d.branch.name : "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  {d.createdAt
                    ? new Date(d.createdAt).toLocaleString("mn-MN")
                    : ""}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: 8,
                  }}
                >
                  <a href={`/users/doctors/${d.id}`}>Профайл</a>
                </td>
              </tr>
            ))}
            {doctors.length === 0 && (
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
