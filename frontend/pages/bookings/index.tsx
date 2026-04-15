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
};

type AdminHomeResponse = {
  branches: BranchCard[];
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

export default function BookingsDashboardPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useAuth();

  const [cards, setCards] = useState<BranchCard[]>([]);
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
        const res = await fetch("/api/dashboard/admin-home", {
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as AdminHomeResponse | null;
        if (!res.ok || !data || !Array.isArray(data.branches)) {
          setError("Хянах самбарын мэдээлэл ачаалж чадсангүй.");
          setCards([]);
          return;
        }
        setCards(data.branches);
        setUpdatedAt(new Date());
      } catch {
        setError("Сүлжээний алдаа гарлаа. Дахин оролдоно уу.");
        setCards([]);
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
          <span style={{ color: "#6b7280", fontSize: 13 }}>Updated {updatedText}</span>
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {cards.map((branch) => {
            const color = getFillingColor(branch.fillingRate);
            const progressWidth = `${Math.max(
              0,
              Math.min(100, branch.fillingRate ?? 0)
            )}%`;

            return (
              <article
                key={branch.branchId}
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  boxShadow:
                    "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(15,23,42,0.06)",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  {branch.branchName}
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 40, lineHeight: 1, color, fontWeight: 800 }}>
                    {branch.fillingRate === null ? "—" : `${branch.fillingRate}%`}
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
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    fontSize: 16,
                  }}
                >
                  <div style={{ color: "#6b7280" }}>{branch.doctorCount} эмч өнөөдөр</div>
                  <div style={{ color: "#111827", fontWeight: 700 }}>
                    {formatMoney(branch.salesToday)} борлуулалт өнөөдөр
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
