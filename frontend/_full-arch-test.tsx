import React, { useState } from "react";
import FullArchDiscOdontogram from "../components/odontogram/FullArchDiscOdontogram";

type DiscTooth = { code: string; status: string };

export default function FullArchTestPage() {
  const [chart, setChart] = useState<DiscTooth[]>([]);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 16 }}>
        Full Arch Disc Odontogram Test
      </h1>
      <FullArchDiscOdontogram value={chart} onChange={setChart} />
    </main>
  );
}
