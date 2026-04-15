import React from "react";

function fmtMnt(value: number) {
  return `${Number(value || 0).toLocaleString("mn-MN")} ₮`;
}

type Props = {
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalUnpaid: number;
    overpayments: number;
  };
};

export default function InvoiceSummaryCards({ summary }: Props) {
  const cards = [
    { label: "💰 Total billed", value: summary.totalBilled, className: "text-blue-700" },
    { label: "💸 Total collected", value: summary.totalCollected, className: "text-green-700" },
    { label: "⚠️ Total unpaid", value: summary.totalUnpaid, className: "text-amber-700" },
    { label: "➕ Overpayments", value: summary.overpayments, className: "text-purple-700" },
  ];

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">{card.label}</div>
          <div className={`mt-2 text-lg font-semibold ${card.className}`}>{fmtMnt(card.value)}</div>
        </div>
      ))}
    </div>
  );
}
