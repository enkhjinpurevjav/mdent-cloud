export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>M Dent Frontend</h1>
      <p>API endpoint: {process.env.NEXT_PUBLIC_API_URL}</p>
      <p>Booking portal: {process.env.NEXT_PUBLIC_PORTAL_URL}</p>
    </main>
  );
}
