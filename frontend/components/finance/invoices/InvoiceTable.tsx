import React from "react";
import type { InvoiceListRow } from "./types";
import {
  formatFinanceDateTime,
  formatInvoiceStatusLabel,
  formatPaymentMethodLabel,
} from "./formatters";

function fmtMnt(value: number) {
  return `${Number(value || 0).toLocaleString("mn-MN")} ₮`;
}

function fmtDoctor(ovog: string | null, name: string | null) {
  const n = (name || "").trim();
  const o = (ovog || "").trim();
  if (o && n) return `${o[0]}. ${n}`;
  return n || o || "-";
}

const STATUS_STYLES: Record<string, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  overpaid: "bg-purple-100 text-purple-700",
  voided: "bg-gray-200 text-gray-700",
};

type Props = {
  rows: InvoiceListRow[];
  loading: boolean;
  error: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  onOpen: (invoiceId: number) => void;
};

export default function InvoiceTable({
  rows,
  loading,
  error,
  page,
  pageSize,
  total,
  onPageChange,
  onOpen,
}: Props) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {error && <div className="m-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              {[
                "Дугаар",
                "Огноо",
                "Үйлчлүүлэгч",
                "Эмч",
                "Салбар",
                "Нийт",
                "Төлсөн",
                "Үлдэгдэл",
                "Төлөв",
                "Төлбөрийн хэрэгсэл",
                "eBarimt",
                "Үйлдэл",
              ].map((title) => (
                <th key={title} className="border-b border-gray-200 px-3 py-2 font-semibold text-gray-700">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                  Ачаалж байна...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                  Нэхэмжлэл олдсонгүй.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onOpen(row.id)}
                  className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40"
                >
                  <td className="px-3 py-2 text-blue-600 font-medium">#{row.id}</td>
                  <td className="px-3 py-2">{formatFinanceDateTime(row.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{fmtDoctor(row.patient.ovog, row.patient.name)}</div>
                    <div className="text-xs text-gray-500">{row.patient.phone || "-"}</div>
                  </td>
                  <td className="px-3 py-2">{fmtDoctor(row.doctor?.ovog || null, row.doctor?.name || null)}</td>
                  <td className="px-3 py-2">{row.branch?.name || "-"}</td>
                  <td className="px-3 py-2 text-right">{fmtMnt(row.total)}</td>
                  <td className="px-3 py-2 text-right">{fmtMnt(row.paid)}</td>
                  <td className="px-3 py-2 text-right">{fmtMnt(row.remaining)}</td>
                  <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status] || "bg-gray-100 text-gray-700"}`}>
                      {formatInvoiceStatusLabel(row.status)}
                      </span>
                    </td>
                  <td className="px-3 py-2">{formatPaymentMethodLabel(row.paymentMethodsLabel)}</td>
                  <td className="px-3 py-2">
                    {row.ebarimt.issued ? (
                      <div className="text-xs text-green-700">
                        Олгосон
                        <div className="text-gray-500">{row.ebarimt.receiptNumber || "-"}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Олгоогүй</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(row.id);
                      }}
                      className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                    >
                      дэлгэрэнгүй
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2 text-sm">
        <div className="text-gray-600">
          Нийт {total} мөр • Хуудас {page}/{totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50"
          >
            Өмнөх
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50"
          >
            Дараах
          </button>
        </div>
      </div>
    </div>
  );
}
