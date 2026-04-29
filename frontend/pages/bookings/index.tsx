import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../contexts/AuthContext";

type BranchCard = {
  branchId: number;
  branchName: string;
  doctorCount: number;
  possibleSlots: number;
  filledSlots: number;
  fillingRate: number | null;
  salesToday: number;
  completedCount: number;
  bookedCount: number;
  noShowCount: number;
};

type AdminHomeResponse = {
  kpis: {
    day: string;
    monthStart: string;
    monthlyNetSales: number;
    dailyAverageSales: number;
    todayTotalSales: number;
    passedDays: number;
  };
  branches: BranchCard[];
  alerts: {
    noShowLostValue: number;
    unpaidInvoicesTotal: number;
    readyToPayCount: number;
  };
  imagingService: {
    monthlyServiceSales: number;
    monthlyServiceCount: number;
    yesterdayServiceCount: number;
  };
  sterilization: {
    dirtyPackageLabel: string;
    completedTodayLabel: string;
  };
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(Math.round(amount)) + "₮";
}

function getFillingColor(rate: number | null) {
  if (rate === null) return "#9ca3af";
  if (rate <= 39) return "#dc2626";
  if (rate <= 69) return "#d97706";
  return "#16a34a";
}

function getBrowserTodayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export default function BookingsDashboardPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();

  const [kpis, setKpis] = useState<AdminHomeResponse["kpis"] | null>(null);
  const [cards, setCards] = useState<BranchCard[]>([]);
  const [alerts, setAlerts] = useState<AdminHomeResponse["alerts"] | null>(null);
  const [imagingService, setImagingService] = useState<AdminHomeResponse["imagingService"] | null>(null);
  const [sterilization, setSterilization] = useState<AdminHomeResponse["sterilization"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  useEffect(() => {
    if (authLoading || !me) return;
    if (!isAdmin) {
      void router.replace("/");
    }
  }, [authLoading, isAdmin, me, router]);

  useEffect(() => {
    if (authLoading || !me || !isAdmin) return;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const day = getBrowserTodayYmd();
        const res = await fetch(`/api/dashboard/admin-home?day=${encodeURIComponent(day)}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as AdminHomeResponse | null;
        if (
          !res.ok ||
          !data ||
          !data.kpis ||
          !data.alerts ||
          !data.imagingService ||
          !data.sterilization ||
          !Array.isArray(data.branches)
        ) {
          setError("Хянах самбарын мэдээлэл ачаалж чадсангүй.");
          setKpis(null);
          setCards([]);
          setAlerts(null);
          setImagingService(null);
          setSterilization(null);
          return;
        }
        setKpis(data.kpis);
        setCards(data.branches);
        setAlerts(data.alerts);
        setImagingService(data.imagingService);
        setSterilization(data.sterilization);
        setUpdatedAt(new Date());
      } catch {
        setError("Сүлжээний алдаа гарлаа. Дахин оролдоно уу.");
        setKpis(null);
        setCards([]);
        setAlerts(null);
        setImagingService(null);
        setSterilization(null);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [authLoading, isAdmin, me]);

  const updatedText = useMemo(() => {
    if (!updatedAt) return null;
    return updatedAt.toLocaleTimeString("mn-MN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, [updatedAt]);

  if (authLoading || (me && !isAdmin)) return null;

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Хянах самбар</h1>
        {updatedText ? (
          <span style={{ color: "#6b7280", fontSize: 13 }}>Шинэчлэгдсэн {updatedText}</span>
        ) : null}
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 16,
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: "#6b7280" }}>Ачааллаж байна...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Row 1: KPI cards */}
          <section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              <article
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                  padding: 20,
                }}
              >
                <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>
                  Энэ сарын цэвэр борлуулалт
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a" }}>
                  {formatMoney(kpis?.monthlyNetSales || 0)}
                </div>
              </article>
              <article
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                  padding: 20,
                }}
              >
                <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>
                  Өдрийн дундаж борлуулалт
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a" }}>
                  {formatMoney(kpis?.dailyAverageSales || 0)}
                </div>
              </article>
              <article
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                  padding: 20,
                }}
              >
                <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>
                  Өнөөдрийн нийт борлуулалт
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a" }}>
                  {formatMoney(kpis?.todayTotalSales || 0)}
                </div>
              </article>
            </div>
          </section>

          {/* Row 2: Branch performance */}
          <section>
            <h2 style={{ margin: "0 0 12px 0", fontSize: 20, fontWeight: 700 }}>
              Салбарын үзүүлэлт
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {cards.map((branch) => {
                const color = getFillingColor(branch.fillingRate);
                const progressWidth = `${Math.max(0, Math.min(100, branch.fillingRate ?? 0))}%`;
                return (
                  <article
                    key={branch.branchId}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      border: "1px solid #e5e7eb",
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{branch.branchName}</h3>
                    <div style={{ color: "#111827", fontWeight: 700 }}>
                      Өнөөдрийн борлуулалт: {formatMoney(branch.salesToday)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b7280" }}>Дүүргэлт</span>
                      <strong style={{ color }}>{branch.fillingRate === null ? "—" : `${branch.fillingRate}%`}</strong>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 9999,
                        overflow: "hidden",
                        background: "#e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          width: progressWidth,
                          height: "100%",
                          background: color,
                          transition: "width 250ms ease",
                        }}
                      />
                    </div>
                    <div style={{ color: "#374151" }}>Эмч ажиллаж буй: {branch.doctorCount}</div>
                    <div style={{ color: "#374151", fontSize: 14 }}>
                      Дууссан / Бүртгэлтэй / Ирээгүй: {branch.completedCount} / {branch.bookedCount} / {branch.noShowCount}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Row 3: Alerts + Imaging Service + Sterilization */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            <article
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Анхааруулга</h3>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Энэ сарын ирээгүй төлвийн алдагдсан боломж
                </div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {formatMoney(alerts?.noShowLostValue || 0)}
                </div>
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Төлөгдөөгүй нэхмэжлэлийн нийт дүн
                </div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {formatMoney(alerts?.unpaidInvoicesTotal || 0)}
                </div>
              </div>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Төлбөр төлөх төлөвтэй үзлэгийн тоо
                </div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {new Intl.NumberFormat("mn-MN").format(alerts?.readyToPayCount || 0)}
                </div>
              </div>
            </article>

            <article
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Зургийн үйлчилгээ</h3>
              <div>
                <div style={{ color: "#111827", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  Борлуулалт
                </div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Энэ сарын үйлчилгээний борлуулалт
                </div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {formatMoney(imagingService?.monthlyServiceSales || 0)}
                </div>
              </div>
              <div>
                <div style={{ color: "#111827", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  Бусад үзүүлэлтүүд
                </div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Энэ сарын үйлчилгээний тоо
                </div>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
                  {new Intl.NumberFormat("mn-MN").format(imagingService?.monthlyServiceCount || 0)}
                </div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Өчигдрийн үйлчилгээний тоо
                </div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>
                  {new Intl.NumberFormat("mn-MN").format(imagingService?.yesterdayServiceCount || 0)}
                </div>
              </div>
            </article>

            <article
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ариутгал</h3>
              <div style={{ color: "#374151" }}>
                {sterilization?.dirtyPackageLabel || "Бохир үзлэгийн багцын тоо"}
              </div>
              <div style={{ color: "#374151" }}>
                {sterilization?.completedTodayLabel || "Өнөөдөр дууссан үзлэгийн тоо"}
              </div>
            </article>
          </section>
        </div>
      )}
    </main>
  );
}
