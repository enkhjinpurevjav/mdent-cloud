import React from "react";

type Props = {
  summary: {
    totalEncounters: number;
    noInvoice: number;
    invoicedUnpaidOrPartial: number;
    freeEncounters: number;
    closedWithoutPayment: number;
  };
};

export default function EncounterFinanceSummaryCards({ summary }: Props) {
  const cards = [
    { label: "Нийт үзлэг", value: summary.totalEncounters, className: "text-blue-700" },
    { label: "Нэхэмжлэлгүй", value: summary.noInvoice, className: "text-gray-700" },
    {
      label: "Нэхэмжлэлтэй боловч төлөгдөөгүй/дутуу",
      value: summary.invoicedUnpaidOrPartial,
      className: "text-amber-700",
    },
    { label: "Төлбөргүй үзлэг", value: summary.freeEncounters, className: "text-blue-700" },
    { label: "Төлбөргүй хаасан", value: summary.closedWithoutPayment, className: "text-purple-700" },
  ];

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">{card.label}</div>
          <div className={`mt-2 text-lg font-semibold ${card.className}`}>{card.value.toLocaleString("mn-MN")}</div>
        </div>
      ))}
    </div>
  );
}
