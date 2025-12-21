import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type Props = {
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon?: string; // simple emoji / placeholder for now
};

const mainNav: NavItem[] = [
  { label: "Хянах самбар", href: "/dashboard", icon: "🏠" },
  { label: "Цаг захиалга", href: "/appointments", icon: "🗓" },
  { label: "Үзлэгүүд", href: "/encounters", icon: "🦷" },
  { label: "Үйлчлүүлэгчид", href: "/patients", icon: "👤" },
  { label: "Ажилтнууд", href: "/staff", icon: "👥" },
];

export default function AdminLayout({ children }: Props) {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        background: "#f3f4f6", // gray-100
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo / user header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            M
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Admin</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Mon Family Dental</div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            padding: "12px 8px 16px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              color: "#9ca3af",
              padding: "4px 12px",
              marginBottom: 4,
            }}
          >
            Хэрэглэгчийн мэдээлэл
          </div>

          {mainNav.map((item) => {
            const active = currentPath === item.href || currentPath.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} legacyBehavior>
                <a
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    margin: "2px 4px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontSize: 14,
                    color: active ? "#111827" : "#374151",
                    background: active ? "#e5f0ff" : "transparent",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span style={{ width: 18, textAlign: "center" }}>
                    {item.icon ?? "•"}
                  </span>
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Footer (branch selector / settings placeholder) */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <div>Салбар: Төв салбар</div>
        </div>
      </aside>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Top bar */}
        <header
          style={{
            height: 56,
            background: "#1d4ed8",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16 }}>M Dent Clinic</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              style={{
                position: "relative",
                width: 32,
                height: 32,
                borderRadius: "999px",
                border: "none",
                background: "rgba(15,23,42,0.25)",
                color: "white",
                cursor: "pointer",
              }}
            >
              🔔
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 10,
                  height: 10,
                  borderRadius: "999px",
                  background: "#ef4444",
                  border: "1px solid white",
                }}
              />
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1d4ed8",
                  fontWeight: 700,
                }}
              >
                E
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>Enkhjin</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Админ</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            padding: 20,
            overflow: "auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
