import React from "react";
import { useRouter } from "next/router";
import { fmtMnt, formatPaymentDateTime, formatPaymentMethod, formatPaymentStatus, formatPersonName } from "./formatters";
import type { PaymentRow } from "./types";

type Props = {
  rows: PaymentRow[];
  loading: boolean;
  error: string;
  page: number;
  pageSize: number;
  total: number;
  canReverse: boolean;
  onOpen: (paymentId: number) => void;
  onPageChange: (nextPage: number) => void;
  onReverse: (paymentId: number) => void;
};

export default function PaymentsTable({
  rows,
  loading,
  error,
  page,
  pageSize,
  total,
  canReverse,
  onOpen,
  onPageChange,
  onReverse,
}: Props) {
  const router = useRouter();
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {error && <div className="m-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1600px] border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              {[
                "Төлбөрийн ID",
                "Огноо/Цаг",
                "Өвчтөн",
                "Нэхэмжлэлийн ID",
                "Салбар",
                "Эмч",
                "Төлбөрийн хэлбэр",
                "Дүн",
                "Төлөв",
                "Бүртгэсэн",
                "Тэмдэглэл/Лавлагаа",
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
                  Төлбөр олдсонгүй.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const reverseAllowed =
                  canReverse &&
                  row.status === "active" &&
                  String(row.invoice?.statusLegacy || "").toLowerCase() !== "voided";

                return (
                  <tr
                    key={row.id}
                    onClick={() => onOpen(row.id)}
                    className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40"
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(row.id);
                        }}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        #{row.id}
                      </button>
                    </td>
                    <td className="px-3 py-2">{formatPaymentDateTime(row.timestamp)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{formatPersonName(row.patient.ovog, row.patient.name)}</div>
                      <div className="text-xs text-gray-500">{row.patient.phone || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      {row.invoice ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void router.push(`/finance/invoices?invoiceId=${row.invoice?.id}`);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          #{row.invoice.id}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">{row.branch?.name || "-"}</td>
                    <td className="px-3 py-2">{formatPersonName(row.doctor?.ovog, row.doctor?.name)}</td>
                    <td className="px-3 py-2">{formatPaymentMethod(row.method)}</td>
                    <td className="px-3 py-2 text-right">{fmtMnt(row.amount)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.status === "reversed" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {formatPaymentStatus(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatPersonName(row.createdByUser?.ovog, row.createdByUser?.name)}</td>
                    <td className="px-3 py-2">{row.reference || row.note || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(row.id);
                          }}
                          className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                        >
                          Харах
                        </button>
                        {reverseAllowed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReverse(row.id);
                            }}
                            className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
                          >
                            Төлбөр буцаах
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
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
