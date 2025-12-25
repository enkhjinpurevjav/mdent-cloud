import React, { useEffect, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onChange?: (blob: Blob) => void;
};

export default function SignaturePad({ disabled, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Fill background white on mount (avoids transparent PNG)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = getPos(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn || !onChange) return;
    canvas.toBlob((blob) => {
      if (blob) onChange(blob);
    }, "image/png");
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={160}
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 8,
          touchAction: "none",
          background: "#ffffff",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <div style={{ marginTop: 4 }}>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #9ca3af",
            background: "#f9fafb",
            fontSize: 12,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          Цэвэрлэх
        </button>
      </div>
    </div>
  );
}
