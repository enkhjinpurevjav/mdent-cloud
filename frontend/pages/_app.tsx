import type { AppProps } from "next/app";
import AdminLayout from "../components/AdminLayout";
import DoctorLayout from "../components/DoctorLayout";
import NurseLayout from "../components/NurseLayout";
import MarketingLayout from "../components/MarketingLayout";
import ReceptionLayout from "../components/ReceptionLayout";
import XrayLayout from "../components/XrayLayout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import "../styles/globals.css";

// Routes that do not require authentication
const PUBLIC_ROUTES = ["/login", "/online", "/print", "/forgot-password", "/reset-password"];

function isPublicPath(pathname: string) {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isDoctorPath(pathname: string) {
  return pathname === "/doctor" || pathname.startsWith("/doctor/");
}

function isNursePath(pathname: string) {
  return pathname === "/nurse" || pathname.startsWith("/nurse/");
}

function isReceptionPath(pathname: string) {
  return pathname === "/reception" || pathname.startsWith("/reception/");
}

function isMarketingPath(pathname: string) {
  return pathname === "/marketing" || pathname.startsWith("/marketing/");
}

function isXrayPath(pathname: string) {
  return pathname === "/xray" || pathname.startsWith("/xray/");
}

function isBranchKioskPath(pathname: string) {
  return pathname === "/branch" || pathname.startsWith("/branch/");
}

function isAppointmentsPath(pathname: string) {
  return (
    pathname === "/appointments" ||
    pathname.startsWith("/appointments/") ||
    pathname === "/appointments-v2" ||
    pathname.startsWith("/appointments-v2/") ||
    pathname === "/reception/appointments" ||
    pathname.startsWith("/reception/appointments/") ||
    pathname === "/marketing/appointments" ||
    pathname.startsWith("/marketing/appointments/")
  );
}

function mapFrontdeskPathByRole(asPath: string, role: string | null) {
  if (!role) return asPath;

  if (role === "marketing" && asPath.startsWith("/reception")) {
    if (asPath.startsWith("/reception/appointments")) {
      return asPath.replace("/reception/appointments", "/marketing/appointments");
    }
    if (asPath.startsWith("/reception/bookings")) {
      return asPath.replace("/reception/bookings", "/marketing/bookings");
    }
    if (asPath.startsWith("/reception/patients")) {
      return asPath.replace("/reception/patients", "/marketing/patients");
    }
    if (asPath.startsWith("/reception/profile")) {
      return asPath.replace("/reception/profile", "/marketing/profile");
    }
    if (asPath.startsWith("/reception/daily-income")) {
      return asPath.replace("/reception/daily-income", "/marketing/daily-income");
    }
    return "/marketing/appointments";
  }

  if (role === "receptionist" && asPath.startsWith("/marketing")) {
    if (asPath.startsWith("/marketing/appointments")) {
      return asPath.replace("/marketing/appointments", "/reception/appointments");
    }
    if (asPath.startsWith("/marketing/bookings")) {
      return asPath.replace("/marketing/bookings", "/reception/bookings");
    }
    if (asPath.startsWith("/marketing/patients")) {
      return asPath.replace("/marketing/patients", "/reception/patients");
    }
    if (asPath.startsWith("/marketing/profile")) {
      return asPath.replace("/marketing/profile", "/reception/profile");
    }
    if (asPath.startsWith("/marketing/daily-income")) {
      return asPath.replace("/marketing/daily-income", "/reception/daily-income");
    }
    return "/reception/appointments";
  }

  return asPath;
}

function ToothLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "12px",
        fontSize: "16px",
        color: "#555",
      }}
    >
      <span style={{ fontSize: "48px" }}>🦷</span>
      <span>ачаалж байна</span>
    </div>
  );
}

function AppContent({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { me, loading } = useAuth();

  const isPublicRoute = isPublicPath(router.pathname);
  const isEncounterPath = router.pathname.startsWith("/encounters/");
  const isPatientPath = router.pathname.startsWith("/patients/");
  const shouldCheckKiosk = isEncounterPath || isPatientPath;

  // Detect doctor_kiosk session for encounter and patient pages: call /api/branch/doctor/me
  const [isDoctorKiosk, setIsDoctorKiosk] = useState<boolean>(false);

  useEffect(() => {
    if (!shouldCheckKiosk) {
      setIsDoctorKiosk(false);
      return;
    }
    fetch("/api/branch/doctor/me", { credentials: "include" })
      .then((res) => setIsDoctorKiosk(res.ok))
      .catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("[kiosk] Failed to check doctor kiosk session:", err);
        }
        setIsDoctorKiosk(false);
      });
  }, [shouldCheckKiosk]);

  useEffect(() => {
    if (loading) return;
    if (!me && !isPublicRoute) {
      router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
    }
  }, [loading, me, isPublicRoute, router]);

  // Keep frontdesk users on their own portal path, even if they open stale URLs.
  useEffect(() => {
    if (loading || !me || isPublicRoute) return;
    if (me.role !== "marketing" && me.role !== "receptionist") return;

    const nextPath = mapFrontdeskPathByRole(router.asPath, me.role);
    if (nextPath !== router.asPath) {
      void router.replace(nextPath);
    }
  }, [isPublicRoute, loading, me, router]);

  // Show tooth loader during initial auth bootstrap for protected pages
  if (loading && !isPublicRoute) {
    return <ToothLoader />;
  }

  // Unauthenticated on a protected route — show loader while redirect is in flight
  if (!loading && !me && !isPublicRoute) {
    return <ToothLoader />;
  }

  if (isPublicRoute) {
    return <Component {...pageProps} />;
  }

  const userRole = me?.role ?? null;

  const useDoctorLayout =
    isDoctorPath(router.pathname) || ((isPatientPath || isEncounterPath) && userRole === "doctor");
  const useNurseLayout = isNursePath(router.pathname);
  const useReceptionLayout = isReceptionPath(router.pathname);
  const useMarketingLayout = isMarketingPath(router.pathname);
  const useXrayLayout = isXrayPath(router.pathname);
  const useBranchKioskLayout = isBranchKioskPath(router.pathname) || userRole === "branch_kiosk";

  // Wide layout for appointments pages (admin + reception) to support many doctor columns
  const wide = isAppointmentsPath(router.pathname);

  if (useDoctorLayout) {
    const showDashboardSummary = router.pathname === "/doctor/appointments";
    return (
      <DoctorLayout showDashboardSummary={showDashboardSummary}>
        <Component {...pageProps} />
      </DoctorLayout>
    );
  }

  if (useNurseLayout) {
    return (
      <NurseLayout>
        <Component {...pageProps} />
      </NurseLayout>
    );
  }

  if (useReceptionLayout) {
    return (
      <ReceptionLayout wide={wide}>
        <Component {...pageProps} />
      </ReceptionLayout>
    );
  }

  if (useMarketingLayout) {
    return (
      <MarketingLayout wide={wide}>
        <Component {...pageProps} />
      </MarketingLayout>
    );
  }

  if (useXrayLayout) {
    return (
      <XrayLayout>
        <Component {...pageProps} />
      </XrayLayout>
    );
  }

  // Branch kiosk pages: keep navy header but hide sidebar
  if (useBranchKioskLayout) {
    return (
      <AdminLayout hideSidebar>
        <Component {...pageProps} />
      </AdminLayout>
    );
  }

  // Encounter pages opened from doctor kiosk session: keep navy header but hide sidebar
  if (isEncounterPath && isDoctorKiosk) {
    return (
      <AdminLayout hideSidebar>
        <Component {...pageProps} />
      </AdminLayout>
    );
  }

  // Patient profile opened by doctor kiosk session: keep navy header but hide sidebar
  if (isPatientPath && isDoctorKiosk) {
    return (
      <AdminLayout hideSidebar>
        <Component {...pageProps} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout wide={wide}>
      <Component {...pageProps} />
    </AdminLayout>
  );
}

export default function MyApp(props: AppProps) {
  return (
    <AuthProvider>
      <AppContent {...props} />
    </AuthProvider>
  );
}
