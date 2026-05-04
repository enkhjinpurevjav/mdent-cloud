import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  Clock,
  ClipboardList,
  LineChart,
  LogOut,
  ScrollText,
  User,
} from "lucide-react";

type Props = {
  children: React.ReactNode;
  wide?: boolean;
  portalType?: "reception" | "marketing";
};

const NAVY = "#131a29";

type BottomNavItem = {
  label: string;
  shortLabel: string;
  href: string;
  icon: "calendarDays" | "calendarRange" | "user";
};

function getBottomNav(portalType: "reception" | "marketing") {
  const base = portalType === "marketing" ? "/marketing" : "/reception";
  const items: BottomNavItem[] = [
    {
      label: "Цаг захиалга",
      shortLabel: "Цаг",
      href: `${base}/appointments`,
      icon: "calendarDays" as const,
    },
    {
      label: "Захиалга",
      shortLabel: "Захиалга",
      href: `${base}/bookings`,
      icon: "calendarRange" as const,
    },
    {
      label: "Үйлчлүүлэгч",
      shortLabel: "Үйлч",
      href: `${base}/patients`,
      icon: "user" as const,
    },
  ];

  if (portalType === "marketing") {
    items.unshift({
      label: "Хянах самбар",
      shortLabel: "Самбар",
      href: "/bookings",
      icon: "calendarRange" as const,
    });
  }

  return items;
}

function isPathActive(pathname: string, href: string) {
  if (href === "/bookings") {
    return pathname === "/bookings" || pathname.startsWith("/bookings/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function BottomIcon({
  kind,
  active,
}: {
  kind: BottomNavItem["icon"];
  active: boolean;
}) {
  const cls = classNames(
    "h-[22px] w-[22px]",
    active ? "text-[#131a29]" : "text-gray-400"
  );

  switch (kind) {
    case "calendarDays":
      return <CalendarDays className={cls} />;
    case "calendarRange":
      return <CalendarRange className={cls} />;
    case "user":
      return <User className={cls} />;
  }
}

export default function ReceptionLayout({ children, wide, portalType: portalTypeProp }: Props) {
  const router = useRouter();
  const { me, logoutAndRedirect } = useAuth();
  const portalType: "reception" | "marketing" =
    portalTypeProp ?? (router.pathname.startsWith("/marketing/") ? "marketing" : "reception");
  const basePath = portalType === "marketing" ? "/marketing" : "/reception";
  const bottomNav = getBottomNav(portalType);
  const isActive = (href: string) => isPathActive(router.pathname, href);

  const handleLogout = async () => {
    await logoutAndRedirect();
  };

  /** Format: Овгийн эхний үсэг.Нэр (e.g. П.Энхжин). Falls back to name or "Рецепшн". */
  const displayName = (() => {
    if (!me) return portalType === "marketing" ? "Маркетинг" : "Рецепшн";
    const ovog = me.ovog?.trim();
    if (ovog) return `${ovog.charAt(0).toUpperCase()}.${me.name}`;
    return me.name || (portalType === "marketing" ? "Маркетинг" : "Рецепшн");
  })();

  return (
    <div className={`min-h-[100dvh] bg-gray-100${wide ? "" : " overflow-x-hidden"}`}>
      {/* Top Bar */}
      <header
        className="fixed top-0 left-0 right-0 h-11 text-white z-[100] overflow-x-hidden"
        style={{ background: NAVY }}
      >
        <div className="h-full w-full px-3 flex items-center justify-between min-w-0 md:max-w-[1024px] md:mx-auto">
          {/* Brand */}
          <Link
            href={`${basePath}/appointments`}
            className="min-w-0 flex items-center gap-2 no-underline text-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mdent.cloud/mdent.svg"
              alt="mDent"
              className="h-7 w-7 shrink-0"
            />
            <span className="min-w-0 truncate font-extrabold tracking-wide text-[13px] sm:text-sm">
              <span className="sm:hidden">
                <span className="text-orange-400">M</span> Dent
              </span>
              <span className="hidden sm:inline">
                <span className="text-orange-400">M</span> Dent • {displayName}
              </span>
            </span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-0 min-w-0">
            <button
              title="Мэдэгдэл"
              disabled
              className="p-1.5 sm:p-2 rounded-lg text-white/60 cursor-default"
            >
              <Bell className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </button>

            {portalType === "reception" && (
              <Link
                href="/reception/attendance"
                title="Ирц бүртгэл"
                aria-label="Ирц бүртгэл"
                className={classNames(
                  "p-1.5 sm:p-2 rounded-lg inline-flex items-center no-underline",
                  isActive("/reception/attendance")
                    ? "text-white"
                    : "text-white/75 hover:text-white"
                )}
              >
                <Clock className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </Link>
            )}

            {(me?.role === "receptionist" || me?.role === "marketing") && (
              <Link
                href="/reception/daily-income"
                title="Өдрийн орлогын тайлан"
                aria-label="Өдрийн орлогын тайлан"
                className={classNames(
                  "p-1.5 sm:p-2 rounded-lg inline-flex items-center no-underline font-bold text-[15px] leading-none",
                  isActive("/reception/daily-income")
                    ? "text-white"
                    : "text-white/75 hover:text-white"
                )}
              >
                ₮
              </Link>
            )}

            {portalType === "marketing" && (
              <>
                <Link
                  href="/marketing/services"
                  title="Үйлчилгээ"
                  aria-label="Үйлчилгээ"
                  className={classNames(
                    "p-1.5 sm:p-2 rounded-lg inline-flex items-center no-underline",
                    isActive("/marketing/services")
                      ? "text-white"
                      : "text-white/75 hover:text-white"
                  )}
                >
                  <ScrollText className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                </Link>
                <Link
                  href="/marketing/reports/main"
                  title="Үндсэн тайлан"
                  aria-label="Үндсэн тайлан"
                  className={classNames(
                    "p-1.5 sm:p-2 rounded-lg inline-flex items-center no-underline",
                    isActive("/marketing/reports/main")
                      ? "text-white"
                      : "text-white/75 hover:text-white"
                  )}
                >
                  <LineChart className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                </Link>
              </>
            )}

            {portalType === "reception" && (
              <Link
                href="/reception/schedule"
                title="Ажлын хуваарь"
                aria-label="Ажлын хуваарь"
                className={classNames(
                  "p-1.5 sm:p-2 rounded-lg inline-flex items-center no-underline",
                  isActive("/reception/schedule")
                    ? "text-white"
                    : "text-white/75 hover:text-white"
                )}
              >
                <ClipboardList className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </Link>
            )}

            <Link
              href={`${basePath}/profile`}
              title="Профайл"
              aria-label="Профайл"
              className={classNames(
                "p-1.5 sm:p-2 rounded-lg inline-flex items-center no-underline",
                isActive(`${basePath}/profile`)
                  ? "text-white"
                  : "text-white/75 hover:text-white"
              )}
            >
              <User className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </Link>

            <button
              onClick={handleLogout}
              title="Гарах"
              className="p-1.5 sm:p-2 rounded-lg text-white/75 hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={`pt-11 pb-[60px] w-full${wide ? " px-2 sm:px-4" : " px-3 sm:px-4 md:max-w-[1024px] md:mx-auto overflow-x-hidden"}`}>
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-gray-200 z-[100] overflow-x-hidden">
        <div className="h-full w-full flex min-w-0 md:max-w-[1024px] md:mx-auto">
          {bottomNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  "flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 no-underline",
                  active
                    ? "text-[#131a29] font-bold border-t-2 border-[#131a29]"
                    : "text-gray-400 font-normal border-t-2 border-transparent"
                )}
              >
                <BottomIcon kind={item.icon} active={active} />

                <span className="text-[10px] leading-none truncate sm:hidden">
                  {item.shortLabel}
                </span>
                <span className="hidden sm:block text-[10px] leading-none truncate px-1">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
