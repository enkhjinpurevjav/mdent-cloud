import Link from "next/link";

export default function Dashboard() {
  return (
    <main style={{ maxWidth: 700, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>🦷 M Дент хянах самбар</h1>
      <nav>
        <ul>
          <li><Link href="/appointments">Цаг захиалга</Link></li>
          <li><Link href="/patients">Үйлчлүүлэгчийн бүртгэл</Link></li>
          <li><Link href="/branches">Эмнэлэг/Салбар</Link></li>
          <li><Link href="/encounters">Үзлэг</Link></li>
          <li><Link href="/billing">Төлбөр</Link></li>
          <li><Link href="/users">Ажилтнууд</Link></li>
          
        </ul>
      </nav>
    </main>
  );
}
