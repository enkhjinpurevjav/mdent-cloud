import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type Props = {
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href?: string;
  icon?: string; // simple icon placeholder
  children?: NavItem[];
};

const mainNav: NavItem[] = [
  { label: "Хянах самбар", href: "/", icon: "🏠" },

  // NOTE: Цаг захиалга is now rendered as a dynamic group below
  // so we don't list it here as a simple item.

  // Үзлэг group with 3 sub‑items
  {
    label: "Үзлэг",
    icon: "📋",
    children: [
      { label: "Цаг захиалсан", href: "/visits/booked", icon: "🕒" },
      { label: "Үзлэг хийж буй", href: "/visits/ongoing", icon: "⏱" },
      { label: "Дууссан", href: "/visits/completed", icon: "✅" },
    ],
  },

  // Patients / encounters
  { label: "Үйлчлүүлэгчид", href: "/patients", icon: "👤" },

  // Users
  { label: "Ажилтнууд", href: "/users", icon: "👥" },
  { label: "Эмч нар", href: "/users/doctors", icon: "🩺" },
  { label: "Сувилагч", href: "/users/nurses", icon: "💉" },
  { label: "Ресепшн", href: "/users/reception", icon: "📞" },
  { label: "Бусад ажилтан", href: "/users/staff", icon: "🏢" },

  // Clinic config
  { label: "Салбарууд", href: "/branches", icon: "🏥" },
  { label: "Үйлчилгээ", href: "/services", icon: "🧾" },
  { label: "Онош", href: "/diagnoses", icon: "🩻" },

  // Reports
  { label: "Тайлан", href: "/reports", icon: "📊" },
];

export default function AdminLayout({ children }: Props) {
  const router = useRouter();
  const currentPath = router.pathname;

  const [visitsOpen, setVisitsOpen] = useState(true); // Үзлэг group
  const [appointmentsOpen, setAppointmentsOpen] = useState(true); // Цаг захиалга group
  const [branchItems, setBranchItems] = useState<{ id: string; name: string }[]>([]);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return currentPath === "/";
    return currentPath === href || currentPath.startsWith(href + "/");
  };

  const isInVisitsGroup =
    currentPath.startsWith("/visits/") || currentPath === "/visits";

  // For appointments group, consider any /appointments route as "in group"
  const isInAppointmentsGroup =
    currentPath === "/appointments" || currentPath.startsWith("/appointments/");

  // Load branches once for Цаг захиалга submenu
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        const mapped = (data || []).map((b: any) => ({
          id: String(b.id),
          name: b.name as string,
        }));
        setBranchItems(mapped);
      })
      .catch(() => setBranchItems([]));
  }, []);

  // Helper to know which branchId is active (from query)
  const activeBranchId =
    typeof router.query.branchId === "string" ? router.query.branchId : "";

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: "#f3f4f6",
      }}
    >
      {/* LEFT SIDEBAR */}
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
          {/* Circle avatar with "M" */}
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

          {/* User / clinic info */}
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Admin</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Mon Family Dental
            </div>
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
            Цэс
          </div>

          {/* Хянах самбар */}
          <div style={{ marginBottom: 4 }}>
            <Link href="/" legacyBehavior>
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
                  color: isActive("/") ? "#111827" : "#374151",
                  background: isActive("/") ? "#e5f0ff" : "transparent",
                  fontWeight: isActive("/") ? 600 : 400,
                }}
              >
                <span style={{ width: 18, textAlign: "center" }}>🏠</span>
                <span>Хянах самбар</span>
              </a>
            </Link>
          </div>

          {/* Цаг захиалга group with dynamic branches */}
          <div style={{ marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => setAppointmentsOpen((open) => !open)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                margin: "2px 4px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                color: isInAppointmentsGroup ? "#111827" : "#374151",
                fontWeight: isInAppointmentsGroup ? 600 : 500,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ width: 18, textAlign: "center" }}>📅</span>
                <span>Цаг захиалга</span>
              </div>
              <span style={{ fontSize: 12 }}>
                {appointmentsOpen ? "▾" : "▸"}
              </span>
            </button>

            {appointmentsOpen && (
              <div style={{ marginLeft: 24, marginTop: 4 }}>
                {/* Бүх салбар */}
                <div style={{ marginBottom: 2 }}>
                  <Link href="/appointments" legacyBehavior>
                    <a
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 8px",
                        borderRadius: 6,
                        textDecoration: "none",
                        fontSize: 13,
                        color:
                          currentPath === "/appointments" && !activeBranchId
                            ? "#1d4ed8"
                            : "#4b5563",
                        backgroundColor:
                          currentPath === "/appointments" && !activeBranchId
                            ? "#eff6ff"
                            : "transparent",
                        fontWeight:
                          currentPath === "/appointments" && !activeBranchId
                            ? 600
                            : 400,
                      }}
                    >
                      <span style={{ width: 18, textAlign: "center" }}>📅</span>
                      <span>Бүх салбар</span>
                    </a>
                  </Link>
                </div>

                {/* One submenu item per branch (auto-updates when new branches are added) */}
                {branchItems.map((b) => {
                  const href = `/appointments?branchId=${encodeURIComponent(
                    b.id
                  )}`;
                  const isActiveBranch =
                    currentPath === "/appointments" &&
                    activeBranchId === b.id;

                  return (
                    <div key={b.id} style={{ marginBottom: 2 }}>
                      <Link href={href} legacyBehavior>
                        <a
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 8px",
                            borderRadius: 6,
                            textDecoration: "none",
                            fontSize: 13,
                            color: isActiveBranch ? "#1d4ed8" : "#4b5563",
                            backgroundColor: isActiveBranch
                              ? "#eff6ff"
                              : "transparent",
                            fontWeight: isActiveBranch ? 600 : 400,
                          }}
                        >
                          <span style={{ width: 18, textAlign: "center" }}>
                            🏥
                          </span>
                          <span>{b.name}</span>
                        </a>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rest of nav: Үзлэг group + normal items from mainNav */}
          {mainNav.map((item) => {
            // Handle Үзлэг group specially
            if (item.label === "Үзлэг" && item.children) {
              return (
                <div key="visits-group">
                  {/* Parent row (click to toggle) */}
                  <button
                    type="button"
                    onClick={() => setVisitsOpen((open) => !open)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      margin: "2px 4px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      color: isInVisitsGroup ? "#111827" : "#374151",
                      fontWeight: isInVisitsGroup ? 600 : 500,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ width: 18, textAlign: "center" }}>
                        {item.icon ?? "•"}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 12 }}>
                      {visitsOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {/* Children */}
                  {visitsOpen &&
                    item.children.map((child) => {
                      const active = isActive(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href!}
                          legacyBehavior
                        >
                          <a
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 12px 6px 32px",
                              margin: "2px 4px",
                              borderRadius: 8,
                              textDecoration: "none",
                              fontSize: 13,
                              color: active ? "#111827" : "#4b5563",
                              background: active ? "#e5f0ff" : "transparent",
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            <span style={{ width: 18, textAlign: "center" }}>
                              {child.icon ?? "•"}
                            </span>
                            <span>{child.label}</span>
                          </a>
                        </Link>
                      );
                    })}
                </div>
              );
            }

            // Normal single link items
            if (!item.href) return null;
            const active = isActive(item.href);

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

        {/* Sidebar footer */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <div>Copyright © 2025 - M Peak LLC</div>
        </div>
      </aside>

      {/* RIGHT SIDE: TOP BAR + PAGE CONTENT */}
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
            height: 64,
            background: "#061325",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
          }}
        >
          {/* LEFT: logo + product name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <img
              src="/logo-mdent.png"
              alt="M Dent Software logo"
              style={{
                height: 44,
                width: 44,
                objectFit: "contain",
                display: "block",
              }}
            />
            <span
              style={{
                fontWeight: 600,
                fontSize: 22,
              }}
            >
              <span style={{ color: "#f97316" }}>M</span> Dent Software
              Solution
            </span>
          </div>

          {/* RIGHT: notification + user */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              style={{
                position: "relative",
                width: 32,
                height: 32,
                borderRadius: "999px",
                border: "none",
                background: "rgba(15,23,42,0.4)",
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

        {/* Page content area */}
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
