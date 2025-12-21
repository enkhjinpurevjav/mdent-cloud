import Link from "next/link";

export default function Dashboard() {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 16,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>🦷 M Дент хянах самбар</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Өнөөдрийн цаг, үзлэг, орлого болон ажилчдын мэдээллийг эндээс харах.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <DashboardCard
          title="Цаг (шинэ)"
          description="Өнөөдрийн цаг захиалгуудыг эмчээр харах."
          href="/bookings"
        />
        <DashboardCard
          title="Үйлчлүүлэгчид"
          description="Шинэ үйлчлүүлэгч бүртгэх, картын дугаар харах."
          href="/patients"
        />
        <DashboardCard
          title="Ажилтнууд"
          description="Эмч, ресепшн, сувилагч болон бусадыг удирдах."
          href="/users"
        />
        <DashboardCard
          title="Тайлан"
          description="Орлого, үзлэг, салбарын тайлангууд."
          href="/reports"
        />
      </section>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} legacyBehavior>
      <a
        style={{
          display: "block",
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          textDecoration: "none",
          color: "#111827",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>{description}</div>
      </a>
    </Link>
  );
}
