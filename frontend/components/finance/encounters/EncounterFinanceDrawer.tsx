import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { formatFinanceDateTime, formatPaymentMethodLabel, formatScheduleDateTimeNaive } from "../invoices/formatters";
import { billingStatusClass, fmtMnt, formatBillingStatus, formatEncounterStatus } from "./formatters";
import type { EncounterFinanceDetail } from "./types";

type Props = {
  encounterId: number | null;
  open: boolean;
  refreshSignal: number;
  onClose: () => void;
  onDataChanged: () => void;
};

export default function EncounterFinanceDrawer({
  encounterId,
  open,
  refreshSignal,
  onClose,
  onDataChanged,
}: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<EncounterFinanceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canCreateInvoice = useMemo(
    () => !!detail && !detail.invoice && !detail.closedWithoutPayment?.value,
    [detail]
  );

  const loadDetail = useCallback(async () => {
    if (!open || !encounterId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/finance/encounters/${encounterId}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Дэлгэрэнгүй мэдээлэл татахад алдаа гарлаа.");
      setDetail(json as EncounterFinanceDetail);
    } catch (err: any) {
      setError(err?.message || "Дэлгэрэнгүй мэдээлэл татахад алдаа гарлаа.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [open, encounterId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, refreshSignal]);

  const handleCreateInvoice = async () => {
    if (!detail || !canCreateInvoice) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/finance/encounters/${detail.id}/create-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Нэхэмжлэл үүсгэхэд алдаа гарлаа.");
      onDataChanged();
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || "Нэхэмжлэл үүсгэхэд алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkFree = async () => {
    if (!detail) return;
    const confirmed = window.confirm("Энэ үзлэгийг төлбөргүй үзлэг болгох уу?");
    if (!confirmed) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/finance/encounters/${detail.id}/mark-free`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Төлбөргүй үзлэг болгоход алдаа гарлаа.");
      onDataChanged();
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || "Төлбөргүй үзлэг болгоход алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h2 className="text-lg font-semibold">Үзлэг #{encounterId || "-"}</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            Хаах
          </button>
        </div>

        <div className="p-4">
          {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Ачаалж байна...</div>
          ) : !detail ? (
            <div className="py-8 text-center text-sm text-gray-500">Мэдээлэл олдсонгүй.</div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 font-semibold">1) Үзлэгийн мэдээлэл</h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>Үзлэгийн ID: <strong>#{detail.id}</strong></div>
                  <div>Захиалгын огноо: <strong>{formatScheduleDateTimeNaive(detail.appointment?.scheduledAt)}</strong></div>
                  <div>Өвчтөн: <strong>{detail.patient?.name || "-"}</strong></div>
                  <div>Эмч: <strong>{detail.doctor?.name || "-"}</strong></div>
                  <div>Салбар: <strong>{detail.branch?.name || "-"}</strong></div>
                  <div>Үзлэгийн төлөв: <strong>{formatEncounterStatus(detail.status)}</strong></div>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 font-semibold">2) Clinical/services summary</h3>
                <div className="mb-2 text-sm text-gray-600">Нийт үйлчилгээ: {detail.clinical.totalItems}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1 text-left">Үйлчилгээ</th>
                        <th className="px-2 py-1 text-right">Тоо</th>
                        <th className="px-2 py-1 text-right">Үнэ</th>
                        <th className="px-2 py-1 text-right">Нийт</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.clinical.services.map((service) => (
                        <tr key={service.id} className="border-t border-gray-100">
                          <td className="px-2 py-1">{service.name}</td>
                          <td className="px-2 py-1 text-right">{service.qty}</td>
                          <td className="px-2 py-1 text-right">{fmtMnt(service.price)}</td>
                          <td className="px-2 py-1 text-right">{fmtMnt(service.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 font-semibold">3) Billing</h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>Нэхэмжлэл: <strong>{detail.invoice?.id ? `#${detail.invoice.id}` : "-"}</strong></div>
                  <div>Нэхэмжлэлийн дүн: <strong>{fmtMnt(detail.invoice?.totalAmount || 0)}</strong></div>
                  <div>Төлсөн: <strong>{fmtMnt(detail.paidAmount)}</strong></div>
                  <div>Үлдэгдэл: <strong>{fmtMnt(detail.remainingAmount)}</strong></div>
                  <div>
                    Төлөв:{" "}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${billingStatusClass(detail.billingStatus)}`}>
                      {formatBillingStatus(detail.billingStatus)}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 font-semibold">4) Payments</h3>
                {detail.payments.length === 0 ? (
                  <div className="text-sm text-gray-500">Төлбөрийн мэдээлэл алга.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-2 py-1 text-left">Арга</th>
                          <th className="px-2 py-1 text-right">Дүн</th>
                          <th className="px-2 py-1 text-left">Огноо</th>
                          <th className="px-2 py-1 text-left">Төлөв</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.payments.map((payment) => (
                          <tr key={payment.id} className="border-t border-gray-100">
                            <td className="px-2 py-1">{formatPaymentMethodLabel(payment.method)}</td>
                            <td className="px-2 py-1 text-right">{fmtMnt(payment.amount)}</td>
                            <td className="px-2 py-1">{formatFinanceDateTime(payment.timestamp)}</td>
                            <td className="px-2 py-1">{payment.status === "reversed" ? "Буцаасан" : "Идэвхтэй"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 font-semibold">5) Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void router.push(`/encounters/${detail.id}`)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                  >
                    Үзлэг нээх
                  </button>
                  {detail.invoice?.id && (
                    <button
                      type="button"
                      onClick={() => void router.push(`/finance/invoices?invoiceId=${detail.invoice?.id}`)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      Нэхэмжлэл нээх
                    </button>
                  )}
                  {canCreateInvoice && (
                    <button
                      type="button"
                      onClick={handleCreateInvoice}
                      disabled={submitting}
                      className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      Нэхэмжлэл үүсгэх
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleMarkFree}
                    disabled={submitting}
                    className="rounded-md border border-purple-300 bg-purple-50 px-2 py-1 text-sm text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                  >
                    Төлбөргүй үзлэг болгох
                  </button>
                </div>
                {detail.closedWithoutPayment?.value && (
                  <div className="mt-2 text-xs text-purple-700">
                    Төлбөргүй хаасан: {detail.closedWithoutPayment.note || "-"}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
