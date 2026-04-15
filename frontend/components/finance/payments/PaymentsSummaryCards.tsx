import React from "react";
import { fmtMnt } from "./formatters";

type Props = {
  summary: {
    totalPayments: number;
    activeTotal: number;
    reversedTotal: number;
    netCollected: number;
  };
};

export default function PaymentsSummaryCards({ summary }: Props) {
  const cards = [
    { label: "Нийт төлбөр", value: summary.totalPayments, valueClass: "text-gray-900", plain: true },
    { label: "Хүлээн авсан дүн", value: summary.activeTotal, valueClass: "text-green-700" },
    { label: "Буцаасан дүн", value: summary.reversedTotal, valueClass: "text-red-700" },
    { label: "Цэвэр орлого", value: summary.netCollected, valueClass: "text-blue-700" },
  ];

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">{card.label}</div>
          <div className={`mt-2 text-lg font-semibold ${card.valueClass}`}>
            {card.plain ? Number(card.value || 0).toLocaleString("mn-MN") : fmtMnt(card.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
