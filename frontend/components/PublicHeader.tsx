export default function PublicHeader() {
  return (
    <header className="h-16 flex items-center px-6 gap-3 shadow" style={{ background: "#061325", color: "white" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mdent.svg"
        alt="M Dent Software logo"
        style={{ height: 34, width: "auto", display: "block" }}
      />
      <span className="font-semibold text-xl">
        <span style={{ color: "#f97316" }}>M</span> Dent Software Solution
      </span>
    </header>
  );
}
