import Link from "next/link";

export default function UsersIndexPage() {
  return (
    <main style={{ maxWidth: 700, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Ажилтнууд</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Ажилтнуудыг ангиллаар нь харах.
      </p>

   <nav>
  <ul
    style={{
      listStyle: "none",
      padding: 0,
      margin: "0 0 16px 0",
      display: "flex",
      gap: 8,
      borderBottom: "1px solid #ddd",
    }}
  >
    <li>
      <Link href="/users/doctors" legacyBehavior>
        <a
          style={{
            display: "inline-block",
            padding: "8px 16px",
            textDecoration: "none",
            color: "#2563eb",
            borderBottom: "3px solid transparent",
          }}
        >
          Эмч
        </a>
      </Link>
    </li>
    <li>
      <Link href="/users/reception" legacyBehavior>
        <a
          style={{
            display: "inline-block",
            padding: "8px 16px",
            textDecoration: "none",
            color: "#2563eb",
            borderBottom: "3px solid transparent",
          }}
        >
          Ресепшн
        </a>
      </Link>
    </li>
    <li>
      <Link href="/users/nurses" legacyBehavior>
        <a
          style={{
            display: "inline-block",
            padding: "8px 16px",
            textDecoration: "none",
            color: "#2563eb",
            borderBottom: "3px solid transparent",
          }}
        >
          Сувилагч
        </a>
      </Link>
    </li>
    <li>
      <Link href="/users/staff" legacyBehavior>
        <a
          style={{
            display: "inline-block",
            padding: "8px 16px",
            textDecoration: "none",
            color: "#2563eb",
            borderBottom: "3px solid transparent",
          }}
        >
          Бусад ажилтан
        </a>
      </Link>
    </li>
  </ul>
</nav>
    </main>
  );
}
