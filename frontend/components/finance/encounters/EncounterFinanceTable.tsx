import React from "react";
import { formatScheduleDateTimeNaive } from "../invoices/formatters";
import { billingStatusClass, fmtMnt, formatBillingStatus, formatEncounterStatus } from "./formatters";
import type { EncounterFinanceRow } from "./types";

type Props = {
  rows: EncounterFinanceRow[];
  loading: boolean;
  error: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  onOpen: (encounterId: number) => void;
};

export default function EncounterFinanceTable({
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
        <table className="w-full min-w-[1400px] text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              {[
                "Үзлэгийн ID",
                "Огноо",
                "Өвчтөн",
                "Эмч",
                "Салбар",
                "Үзлэгийн төлөв",
                "Нэхэмжлэл",
                "Нэхэмжлэлийн дүн",
                "Төлсөн",
                "Үлдэгдэл",
                "Төлөв",
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
                  Үзлэг олдсонгүй.
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
                  <td className="px-3 py-2">{formatScheduleDateTimeNaive(row.appointment?.scheduledAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{row.patient?.name || "-"}</div>
                    <div className="text-xs text-gray-500">{row.patient?.phone || "-"}</div>
                  </td>
                  <td className="px-3 py-2">{row.doctor?.name || "-"}</td>
                  <td className="px-3 py-2">{row.branch?.name || "-"}</td>
                  <td className="px-3 py-2">{formatEncounterStatus(row.status)}</td>
                  <td className="px-3 py-2">{row.invoice?.id ? `#${row.invoice.id}` : "-"}</td>
                  <td className="px-3 py-2 text-right">{fmtMnt(row.invoice?.totalAmount || 0)}</td>
                  <td className="px-3 py-2 text-right">{fmtMnt(row.paidAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmtMnt(row.remainingAmount)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${billingStatusClass(row.billingStatus)}`}
                    >
                      {formatBillingStatus(row.billingStatus)}
                    </span>
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
                      Харах
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
