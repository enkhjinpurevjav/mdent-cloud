import React, { useState } from "react";
import ToothSvg5Region, {
  ToothBaseStatus,
  ToothRegionState,
} from "../components/odontogram/ToothSvg5Region";

type Regions = {
  top: ToothRegionState;
  bottom: ToothRegionState;
  left: ToothRegionState;
  right: ToothRegionState;
  center: ToothRegionState;
};

export default function ToothTestPage() {
  const [baseStatus, setBaseStatus] = useState<ToothBaseStatus>("none");
  const [regions, setRegions] = useState<Regions>({
    top: { caries: false, filled: false },
    bottom: { caries: false, filled: false },
    left: { caries: false, filled: false },
    right: { caries: false, filled: false },
    center: { caries: false, filled: false },
  });

  return (
    <main
      style={{
        maxWidth: 400,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 16 }}>Tooth SVG Test</h1>

      <ToothSvg5Region
        code="11"
        baseStatus={baseStatus}
        regions={regions}
        onClickRegion={(r) =>
          setRegions((prev) => ({
            ...prev,
            [r]: {
              ...prev[r],
              caries: !prev[r].caries,
            },
          }))
        }
        isActive
      />

      <div style={{ marginTop: 16, fontSize: 13 }}>
        <div style={{ marginBottom: 4 }}>Base status:</div>
        <select
          value={baseStatus}
          onChange={(e) => setBaseStatus(e.target.value as ToothBaseStatus)}
        >
          <option value="none">none</option>
          <option value="extracted">extracted</option>
          <option value="prosthesis">prosthesis</option>
          <option value="delay">delay</option>
          <option value="apodontia">apodontia</option>
          <option value="shapeAnomaly">shapeAnomaly</option>
        </select>
      </div>
    </main>
  );
}
