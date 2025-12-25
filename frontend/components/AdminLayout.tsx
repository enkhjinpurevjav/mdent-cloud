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

const mainNav: NavItem[] = [
  // 1. Хянах самбар (already has its own single link below)
  // 2. Цаг захиалах → just one submenu "Салбарууд" (we show existing appointments UI)
  {
    label: "Цаг захиалах",
    icon: "📅",
    children: [
      {
        label: "Салбарууд",
        href: "/appointments", // existing calendar, with branch filter inside
        icon: "🏥",
      },
    ],
  },

  // 3. Үзлэг
  {
    label: "Үзлэг",
    icon: "📋",
    children: [
      { label: "Цаг захиалсан", href: "/visits/booked", icon: "🕒" },
      { label: "Үзлэг хийж буй", href: "/visits/ongoing", icon: "⏱" },
      { label: "Дууссан", href: "/visits/completed", icon: "✅" },
    ],
  },

  // 4. Үйлчлүүлэгчид (list of customers)
  {
    label: "Үйлчлүүлэгчид",
    icon: "👤",
    children: [
      {
        label: "List of customers",
        href: "/patients",
        icon: "📋",
      },
    ],
  },

  // 5. Хүний нөөц
  {
    label: "Хүний нөөц",
    icon: "👥",
    children: [
      { label: "Эмч", href: "/users/doctors", icon: "🩺" },
      { label: "Ресепшн", href: "/users/reception", icon: "📞" },
      { label: "Сувилагч", href: "/users/nurses", icon: "💉" },
      { label: "Ажилтан", href: "/users/staff", icon: "🏢" },
      // new / future pages – placeholders for now
      {
        label: "Ажлын анкет мэдээллийн сан",
        href: "/hr/applicant-database",
        icon: "📁",
      },
      { label: "Материал", href: "/hr/materials", icon: "📦" },
      { label: "Тайлан харах", href: "/hr/reports", icon: "📊" },
    ],
  },

  // 6. Санхүү
  {
    label: "Санхүү",
    icon: "💰",
    children: [
      { label: "Авлага", href: "/finance/debts", icon: "📄" },
      { label: "Илүү төлөлт", href: "/finance/overpayments", icon: "➕" },
      { label: "Бартер", href: "/finance/barter", icon: "🔄" },
      { label: "Ажилчдын ваучер", href: "/finance/vouchers", icon: "🎟️" },
      { label: "Ажилчдын тайлан", href: "/finance/staff-reports", icon: "👥" },
      {
        label: "Эмнэлгийн тайлан",
        href: "/finance/clinic-reports",
        icon: "🏥",
      },
    ],
  },

  // 7. Үйлчилгээ
  {
    label: "Үйлчилгээ",
    icon: "🧾",
    children: [
      { label: "Эмчилгээ үйлчилгээ", href: "/services", icon: "🦷" },
      { label: "Бараа материал", href: "/inventory", icon: "📦" },
      { label: "Жор", href: "/prescriptions", icon: "💊" },
      { label: "Онош", href: "/diagnoses", icon: "🩻" },
    ],
  },

  // 8. Төлбөрийн тохиргоо
  {
    label: "Төлбөрийн тохиргоо",
    icon: "💳",
    children: [
      { label: "Төлбөрийн тохиргоо", href: "/settings/payments", icon: "⚙️" },
    ],
  },

  // 9. Салбарын тохиргоо
  {
    label: "Салбарын тохиргоо",
    icon: "🏥",
    children: [
      { label: "Салбарууд", href: "/branches", icon: "🏥" },
    ],
  },

  // 10. Үндсэн тайлан
  {
    label: "Үндсэн тайлан",
    icon: "📈",
    children: [
      { label: "Үндсэн тайлан", href: "/reports", icon: "📊" },
    ],
  },
];

export default function AdminLayout({ children }: Props) {
  const router = useRouter();
  const currentPath = router.pathname;

  const [visitsOpen, setVisitsOpen] = useState(true);
  const [appointmentsOpen, setAppointmentsOpen] = useState(true);
  const [staffOpen, setStaffOpen] = useState(true);
  const [hrOpen, setHrOpen] = useState(true);
  const [financeOpen, setFinanceOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [branchesCfgOpen, setBranchesCfgOpen] = useState(true);
  const [mainReportOpen, setMainReportOpen] = useState(true);

  const [branchItems, setBranchItems] = useState<{ id: string; name: string }[]>(
    []
  );

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return currentPath === "/";
    return currentPath === href || currentPath.startsWith(href + "/");
  };

  const isInVisitsGroup =
    currentPath.startsWith("/visits/") || currentPath === "/visits";

  const isInAppointmentsGroup =
    currentPath === "/appointments" || currentPath.startsWith("/appointments/");

  const isInHrGroup =
    currentPath.startsWith("/users/") ||
    currentPath.startsWith("/hr/") ||
    currentPath === "/users" ||
    currentPath === "/hr";

  const isInFinanceGroup =
    currentPath.startsWith("/finance/") || currentPath === "/finance";

  const isInServicesGroup =
    currentPath.startsWith("/services") ||
    currentPath.startsWith("/inventory") ||
    currentPath.startsWith("/prescriptions") ||
    currentPath.startsWith("/diagnoses");

  const isInPaymentSettingsGroup =
    currentPath.startsWith("/settings/payments") ||
    currentPath === "/settings";

  const isInBranchesCfgGroup =
    currentPath.startsWith("/branches") || currentPath === "/branches";

  const isInMainReportGroup =
    currentPath.startsWith("/reports") || currentPath === "/reports";

  // Load branches once (still used for appointments "Салбарууд" filter)
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

          {/* 1. Хянах самбар (single item) */}
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

          {/* 2–10 menu groups from mainNav */}
          {mainNav.map((item) => {
            // Цаг захиалах group: we keep extra dynamic branch list for /appointments
            if (item.label === "Цаг захиалах") {
              return (
                <div key="appointments-group" style={{ marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setAppointmentsOpen((open) => !open)
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
                      <span style={{ width: 18, textAlign: "center" }}>
                        {item.icon ?? "•"}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 12 }}>
                      {appointmentsOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {appointmentsOpen && (
                    <div style={{ marginLeft: 24, marginTop: 4 }}>
                      {/* Submenu: Салбарууд (all branches) */}
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
                                currentPath === "/appointments" &&
                                !activeBranchId
                                  ? "#1d4ed8"
                                  : "#4b5563",
                              backgroundColor:
                                currentPath === "/appointments" &&
                                !activeBranchId
                                  ? "#eff6ff"
                                  : "transparent",
                              fontWeight:
                                currentPath === "/appointments" &&
                                !activeBranchId
                                  ? 600
                                  : 400,
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                textAlign: "center",
                              }}
                            >
                              🏥
                            </span>
                            <span>Салбарууд</span>
                          </a>
                        </Link>
                      </div>

                      {/* Dynamic branches (existing behaviour) */}
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
                                  color: isActiveBranch
                                    ? "#1d4ed8"
                                    : "#4b5563",
                                  backgroundColor: isActiveBranch
                                    ? "#eff6ff"
                                    : "transparent",
                                  fontWeight: isActiveBranch ? 600 : 400,
                                }}
                              >
                                <span
                                  style={{
                                    width: 18,
                                    textAlign: "center",
                                  }}
                                >
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
              );
            }

            // Үзлэг group
            if (item.label === "Үзлэг" && item.children) {
              return (
                <div key="visits-group">
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

            // Хүний нөөц group
            if (item.label === "Хүний нөөц" && item.children) {
              return (
                <div key="hr-group">
                  <button
                    type="button"
                    onClick={() => setHrOpen((open) => !open)}
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
                      color: isInHrGroup ? "#111827" : "#374151",
                      fontWeight: isInHrGroup ? 600 : 500,
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
                      {hrOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {hrOpen &&
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

            // Санхүү group
            if (item.label === "Санхүү" && item.children) {
              return (
                <div key="finance-group">
                  <button
                    type="button"
                    onClick={() => setFinanceOpen((open) => !open)}
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
                      color: isInFinanceGroup ? "#111827" : "#374151",
                      fontWeight: isInFinanceGroup ? 600 : 500,
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
                      {financeOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {financeOpen &&
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

            // Үйлчилгээ group
            if (item.label === "Үйлчилгээ" && item.children) {
              return (
                <div key="services-group">
                  <button
                    type="button"
                    onClick={() => setServicesOpen((open) => !open)}
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
                      color: isInServicesGroup ? "#111827" : "#374151",
                      fontWeight: isInServicesGroup ? 600 : 500,
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
                      {servicesOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {servicesOpen &&
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

            // Төлбөрийн тохиргоо
            if (item.label === "Төлбөрийн тохиргоо" && item.children) {
              return (
                <div key="payment-settings-group">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((open) => !open)}
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
                      color: isInPaymentSettingsGroup
                        ? "#111827"
                        : "#374151",
                      fontWeight: isInPaymentSettingsGroup ? 600 : 500,
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
                      {settingsOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {settingsOpen &&
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

            // Салбарын тохиргоо
            if (item.label === "Салбарын тохиргоо" && item.children) {
              return (
                <div key="branches-config-group">
                  <button
                    type="button"
                    onClick={() =>
                      setBranchesCfgOpen((open) => !open)
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
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      color: isInBranchesCfgGroup ? "#111827" : "#374151",
                      fontWeight: isInBranchesCfgGroup ? 600 : 500,
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
                      {branchesCfgOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {branchesCfgOpen &&
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

            // Үндсэн тайлан
            if (item.label === "Үндсэн тайлан" && item.children) {
              return (
                <div key="main-report-group">
                  <button
                    type="button"
                    onClick={() =>
                      setMainReportOpen((open) => !open)
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
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      color: isInMainReportGroup ? "#111827" : "#374151",
                      fontWeight: isInMainReportGroup ? 600 : 500,
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
                      {mainReportOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {mainReportOpen &&
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

            return null;
          })}
        </nav>

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

      {/* RIGHT SIDE */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Top bar stays unchanged */}
        {/* ... existing header + main content ... */}
        {/* (keep your current header and main from the working file) */}
      </div>
    </div>
  );
}
