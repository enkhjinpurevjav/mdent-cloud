import React, { useEffect, useState } from "react";
import Link from "next/link";

type Branch = {
  id: number;
  name: string;
};

type User = {
  id: number;
  email: string;
  name?: string | null;
  ovog?: string | null;
  role: string;
  regNo?: string | null;
  phone?: string | null;
  branchId?: number | null;
  branch?: Branch | null;
};

export default function UsersIndexPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/users");
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !Array.isArray(data)) {
          throw new Error((data && data.error) || "Алдаа гарлаа");
        }

        setUsers(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Сүлжээгээ шалгана уу");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "doctor":
        return "Эмч";
      case "receptionist":
        return "Ресепшн";
      case "nurse":
        return "Сувилагч";
      case "accountant":
        return "Нягтлан";
      case "manager":
        return "Менежер";
      case "admin":
        return "Админ";
      default:
        return role;
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
      <h1>Ажилтнууд</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Эмч, ресепшн, сувилагч болон бусад ажилтнуудын мэдээллийг нэг жагсаалтаар
        харах.
      </p>

      {/* Tabs as links */}
      <nav>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 16px 0",
            display: "flex",
            gap: 8,
            borderBottom: "1px solid #ddd",
          }}
        >
          <li>
            <Link href="/users/doctors" legacyBehavior>
              <a
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  textDecoration: "none",
                  color: "#2563eb",
                  borderBottom: "3px solid transparent",
                }}
              >
                Эмч
              </a>
            </Link>
          </li>
          <li>
            <Link href="/users/reception" legacyBehavior>
              <a
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  textDecoration: "none",
                  color: "#2563eb",
                  borderBottom: "3px solid transparent",
                }}
              >
                Ресепшн
              </a>
            </Link>
          </li>
          <li>
            <Link href="/users/nurses" legacyBehavior>
              <a
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  textDecoration: "none",
                  color: "#2563eb",
                  borderBottom: "3px solid transparent",
                }}
              >
                Сувилагч
              </a>
            </Link>
          </li>
          <li>
            <Link href="/users/staff" legacyBehavior>
              <a
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  textDecoration: "none",
                  color: "#2563eb",
                  borderBottom: "3px solid transparent",
                }}
              >
                Бусад ажилтан
              </a>
            </Link>
          </li>
        </ul>
      </nav>

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
                Албан тушаал
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
                Салбар
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
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
                  {getRoleLabel(u.role)}
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
                  {u.branch ? u.branch.name : "-"}
                </td>
              </tr>
            ))}
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
