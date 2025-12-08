import Link from "next/link";

export default function UsersIndexPage() {
  return (
    <main
      style={{
        maxWidth: 700,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Ажилтнууд</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Ажилтнуудыг ангиллаар нь харах.
      </p>

      <nav>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <li>
            <Link href="/users/doctors">Эмч</Link>
          </li>
          <li>
            <Link href="/users/receptionists">Ресепшн</Link>
          </li>
          <li>
            <Link href="/users/nurses">Сувилагч</Link>
          </li>
          <li>
            <Link href="/users/accountants">Нягтлан / Нярав</Link>
          </li>
          <li>
            <Link href="/users/managers">Менежерүүд</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
