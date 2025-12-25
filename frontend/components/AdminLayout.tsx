import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type Props = {
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href?: string;
  icon?: string;
  children?: NavItem[];
};

// Main navigation structure based on your spreadsheet
const navItems: NavItem[] = [
  // 1. Хянах самбар (top-level link only, no submenu here)
  {
    label: "Хянах самбар",
    href: "/",
    icon: "🏠",
  },

  // 2. Цаг захиалах
  {
    label: "Цаг захиалах",
    icon: "📅",
    children: [
      {
        label: "Салбарууд",
        href: "/appointments", // existing page; branch filter inside
      },
    ],
  },

  // 3. Үзлэг
  {
    label: "Үзлэг",
    icon: "📋",
    children: [
      { label: "Цаг захиалсан", href: "/visits/booked" },
      { label: "Үзлэг хийж буй", href: "/visits/ongoing" },
      { label: "Дууссан", href: "/visits/completed" },
    ],
  },

  // 4. Үйлчлүүлэгчид
  {
    label: "Үйлчлүүлэгчид",
    icon: "👤",
    children: [
      { label: "List of customers", href: "/patients" },
    ],
  },

  // 5. Хүний нөөц
  {
    label: "Хүний нөөц",
    icon: "👥",
    children: [
      { label: "Эмч", href: "/users/doctors" },
      { label: "Ресепшн", href: "/users/reception" },
      { label: "Сувилагч", href: "/users/nurses" },
      { label: "Ажилтан", href: "/users/staff" },
      { label: "Ажлын анкет мэдээллийн сан", href: "/hr/applicant-database" },
      { label: "Материал", href: "/hr/materials" },
      { label: "Тайлан харах", href: "/hr/reports" },
    ],
  },

  // 6. Санхүү
  {
    label: "Санхүү",
    icon: "💰",
    children: [
      { label: "Авлага", href: "/finance/debts" },
      { label: "Илүү төлөлт", href: "/finance/overpayments" },
      { label: "Бартер", href: "/finance/barter" },
      { label: "Ажилчдын ваучер", href: "/finance/vouchers" },
      { label: "Ажилчдын тайлан", href: "/finance/staff-reports" },
      { label: "Эмнэлгийн тайлан", href: "/finance/clinic-reports" },
    ],
  },

  // 7. Үйлчилгээ
  {
    label: "Үйлчилгээ",
    icon: "🧾",
    children: [
      { label: "Эмчилгээ үйлчилгээ", href: "/services" },
      { label: "Бараа материал", href: "/inventory" },
      { label: "Жор", href: "/prescriptions" },
      { label: "Онош", href: "/diagnoses" },
    ],
  },

  // 8. Төлбөрийн тохиргоо
  {
    label: "Төлбөрийн тохиргоо",
    icon: "💳",
    children: [{ label: "Төлбөрийн тохиргоо", href: "/settings/payments" }],
  },

  // 9. Салбарын тохиргоо
  {
    label: "Салбарын тохиргоо",
    icon: "🏥",
    children: [{ label: "Салбарууд", href: "/branches" }],
  },

  // 10. Үндсэн тайлан
  {
    label: "Үндсэн тайлан",
    icon: "📈",
    children: [{ label: "Үндсэн тайлан", href: "/reports" }],
  },
];

export default function AdminLayout({ children }: Props) {
  const router = useRouter();
  const currentPath = router.pathname;

  // which main menu label is open (for dropdown)
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Auto-open the group that contains the current path
  useEffect(() => {
    const found = navItems.find((item) => {
      if (!item.children) return false;
      return item.children.some((child) => {
        if (!child.href) return false;
        if (child.href === "/") return currentPath === "/";
        return (
          currentPath === child.href ||
          currentPath.startsWith(child.href + "/")
        );
      });
    });
    if (found) {
      setOpenGroup(found.label);
    } else {
      setOpenGroup(null);
    }
  }, [currentPath]);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return currentPath === "/";
    return currentPath === href || currentPath.startsWith(href + "/");
  };

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
          width: 260,
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

          {navItems.map((item) => {
            // Case 1: top-level direct link (Хянах самбар)
            if (!item.children && item.href) {
              const active = isActive(item.href);
              return (
                <div key={item.label} style={{ marginBottom: 4 }}>
                  <Link href={item.href} legacyBehavior>
                    <a
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        margin: "2px 4px",
                        borderRadius: 12,
                        textDecoration: "none",
                        fontSize: 14,
                        color: active ? "#0f172a" : "#1f2937",
                        background: active ? "#e5f0ff" : "transparent",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      <span style={{ width: 20, textAlign: "center" }}>
                        {item.icon ?? "•"}
                      </span>
                      <span>{item.label}</span>
                    </a>
                  </Link>
                </div>
              );
            }

            // Case 2: expandable group with children
            const isOpen = openGroup === item.label;
            const groupActive =
              isOpen ||
              (item.children ?? []).some((child) => isActive(child.href));

            return (
              <div key={item.label} style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup((prev) =>
                      prev === item.label ? null : item.label
                    )
                  }
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    margin: "2px 4px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 14,
                    color: groupActive ? "#0f172a" : "#1f2937",
                    fontWeight: groupActive ? 600 : 500,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ width: 20, textAlign: "center" }}>
                      {item.icon ?? "•"}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#4b5563" }}>
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>

                {isOpen && item.children && (
                  <div style={{ marginTop: 2, marginLeft: 28 }}>
                    {item.children.map((child) => {
                      const active = isActive(child.href);
                      return (
                        <Link
                          key={child.label}
                          href={child.href || "#"}
                          legacyBehavior
                        >
                          <a
                            style={{
                              display: "block",
                              padding: "6px 10px",
                              margin: "1px 0",
                              borderRadius: 8,
                              textDecoration: "none",
                              fontSize: 13,
                              color: active ? "#1d4ed8" : "#4b5563",
                              background: active ? "#eff6ff" : "transparent",
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {child.label}
                          </a>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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

      {/* RIGHT SIDE: TOP BAR + PAGE CONTENT (unchanged from your current layout) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
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
