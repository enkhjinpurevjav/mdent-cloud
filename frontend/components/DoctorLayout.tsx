import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { logout } from "../utils/auth";

type Props = {
  children: React.ReactNode;
};

const BOTTOM_NAV = [
  { label: "Цагууд", href: "/doctor/appointments", icon: "📅" },
  { label: "Хуваарь", href: "/doctor/schedule", icon: "🗓" },
  { label: "Борлуулалт", href: "/doctor/sales", icon: "💰" },
  { label: "Профайл", href: "/doctor/profile", icon: "👤" },
];

const TOP_H = 56;
const BOTTOM_H = 60;

export default function DoctorLayout({ children }: Props) {
  const router = useRouter();

  const isActive = (href: string) => router.pathname.startsWith(href);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-gray-100 overflow-x-hidden">
      {/* Top Bar (fixed to viewport) */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#0f2044] text-white z-[100]">
        <div className="h-full max-w-[720px] mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/doctor/appointments"
            className="text-white font-extrabold text-[18px] no-underline tracking-wide"
          >
            mDent
          </Link>

          {/* Right icon buttons */}
          <div className="flex items-center gap-1">
            {/* Notifications (UI only, disabled) */}
            <button
              title="Мэдэгдэл"
              disabled
              className="p-2 rounded-lg text-[20px] leading-none text-white/50 cursor-default"
            >
              🔔
            </button>

            {/* Гүйцэтгэл */}
            <Link
              href="/doctor/performance"
              title="Гүйцэтгэл"
              className={[
                "p-2 rounded-lg text-[20px] leading-none inline-flex items-center no-underline",
                isActive("/doctor/performance")
                  ? "text-blue-300"
                  : "text-white/85",
              ].join(" ")}
            >
              📊
            </Link>

            {/* Үзлэгийн түүх */}
            <Link
              href="/doctor/history"
              title="Үзлэгийн түүх"
              className={[
                "p-2 rounded-lg text-[20px] leading-none inline-flex items-center no-underline",
                isActive("/doctor/history") ? "text-blue-300" : "text-white/85",
              ].join(" ")}
            >
              📋
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Гарах"
              className="p-2 rounded-lg text-[18px] leading-none text-white/70 hover:text-white"
            >
              ⎋
            </button>
          </div>
        </div>
      </header>

      {/* Content (padded for fixed bars) */}
      <main
        className="pt-14 pb-[60px] max-w-[720px] mx-auto overflow-x-hidden"
        // keep exact heights aligned with header/nav
        style={{ paddingTop: TOP_H, paddingBottom: BOTTOM_H }}
      >
        {children}
      </main>

      {/* Bottom Navigation (fixed to viewport) */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-gray-200 z-[100]">
        <div className="h-full max-w-[720px] mx-auto flex">
          {BOTTOM_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex-1 flex flex-col items-center justify-center gap-0.5 no-underline text-[10px]",
                  active
                    ? "text-[#0f2044] font-bold border-t-2 border-[#0f2044]"
                    : "text-gray-400 font-normal border-t-2 border-transparent",
                ].join(" ")}
              >
                <span className="text-[22px] leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
