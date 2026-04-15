import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import AddPaymentModal from "./AddPaymentModal";
import type { InvoiceDetail } from "./types";
import {
  formatFinanceDateTime,
  formatPaymentMethodLabel,
  formatScheduleDateTimeNaive,
} from "./formatters";

function fmtMnt(value: number) {
  return `${Number(value || 0).toLocaleString("mn-MN")} ₮`;
}

function fmtName(ovog: string | null | undefined, name: string | null | undefined) {
  const n = (name || "").trim();
  const o = (ovog || "").trim();
  if (o && n) return `${o[0]}. ${n}`;
  return n || o || "-";
}

type Props = {
  invoiceId: number | null;
  open: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  refreshSignal: number;
};

export default function InvoiceDrawer({
  invoiceId,
  open,
  onClose,
  onDataChanged,
  refreshSignal,
}: Props) {
  const { me } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState("");
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const canLoad = open && !!invoiceId;

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Нэхэмжлэл татахад алдаа гарлаа.");
      setInvoice(json as InvoiceDetail);
    } catch (err: any) {
      setError(err?.message || "Нэхэмжлэл татахад алдаа гарлаа.");
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (canLoad) {
      void load();
    }
  }, [canLoad, load, refreshSignal]);

  const paid = invoice?.paid || 0;
  const total = invoice?.total || 0;
  const remaining = invoice?.remaining || 0;

  const canIssue = useMemo(() => {
    if (!invoice) return false;
    return total > 0 && paid >= total;
  }, [invoice, paid, total]);
  const canVoid = me?.role === "admin" || me?.role === "super_admin";

  const issueEbarimt = async () => {
    if (!invoiceId) return;
    setIssuing(true);
    setIssueError("");
    try {
      const res = await fetch(`/api/ebarimt/invoices/${invoiceId}/issue`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "eBarimt гаргахад алдаа гарлаа.");
      await load();
      onDataChanged();
    } catch (err: any) {
      setIssueError(err?.message || "eBarimt гаргахад алдаа гарлаа.");
    } finally {
      setIssuing(false);
    }
  };

  const reissueEbarimt = async () => {
    if (!invoiceId) return;
    setIssuing(true);
    setIssueError("");
    try {
      const refundRes = await fetch(`/api/ebarimt/invoices/${invoiceId}/refund`, {
        method: "POST",
        credentials: "include",
      });
      const refundJson = await refundRes.json().catch(() => null);
      if (!refundRes.ok) {
        throw new Error(refundJson?.error || "eBarimt буцаахад алдаа гарлаа.");
      }

      const issueRes = await fetch(`/api/ebarimt/invoices/${invoiceId}/issue`, {
        method: "POST",
        credentials: "include",
      });
      const issueJson = await issueRes.json().catch(() => null);
      if (!issueRes.ok) {
        throw new Error(issueJson?.error || "eBarimt дахин гаргахад алдаа гарлаа.");
      }

      await load();
      onDataChanged();
    } catch (err: any) {
      setIssueError(err?.message || "eBarimt дахин гаргахад алдаа гарлаа.");
    } finally {
      setIssuing(false);
    }
  };

  const onPaymentSuccess = async () => {
    await load();
    onDataChanged();
  };

  const voidInvoice = async () => {
    if (!invoiceId) return;
    setVoiding(true);
    setVoidError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/void`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Нэхэмжлэл устгахад алдаа гарлаа.");
      setVoidConfirmOpen(false);
      await load();
      onDataChanged();
    } catch (err: any) {
      setVoidError(err?.message || "Нэхэмжлэл устгахад алдаа гарлаа.");
    } finally {
      setVoiding(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[1110] h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h2 className="text-base font-semibold">Нэхэмжлэл #{invoiceId || "-"}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-gray-500">
            ×
          </button>
        </div>

        <div className="p-4">
          {loading && <p className="text-sm text-gray-500">Ачаалж байна...</p>}
          {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

          {!loading && !error && invoice && (
            <>
              <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-gray-500">Огноо</div>
                    <div>{formatFinanceDateTime(invoice.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Захиалгын огноо:</div>
                    <div>{formatScheduleDateTimeNaive(invoice.encounter?.appointment?.scheduledAt)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Үйлчлүүлэгч</div>
                    <div>{fmtName(invoice.patient.ovog, invoice.patient.name)}</div>
                    <div className="text-xs text-gray-500">{invoice.patient.phone || "-"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Эмч</div>
                    <div>{fmtName(invoice.doctor?.ovog, invoice.doctor?.name)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Салбар</div>
                    <div>{invoice.branch?.name || "-"}</div>
                  </div>
                </div>
              </div>

              <h3 className="mb-2 text-sm font-semibold">Нэхэмжлэлийн дэлгэрэнгүй</h3>
              <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Үйлчилгээ</th>
                      <th className="px-3 py-2 text-right">Тоо</th>
                      <th className="px-3 py-2 text-right">Үнэ</th>
                      <th className="px-3 py-2 text-right">Нийт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{fmtMnt(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{fmtMnt(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-2 text-sm font-semibold">Төлбөрүүд</h3>
              <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Төлбөрийн хэрэгсэл</th>
                      <th className="px-3 py-2 text-right">Дүн</th>
                      <th className="px-3 py-2 text-left">Хугацаа</th>
                      <th className="px-3 py-2 text-left">Бүртгэсэн</th>
                      <th className="px-3 py-2 text-left">Тайлбар</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                          Төлбөр бүртгэлгүй байна.
                        </td>
                      </tr>
                    ) : (
                      invoice.payments.map((payment) => (
                        <tr key={payment.id} className="border-t border-gray-100">
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                              {formatPaymentMethodLabel(payment.method)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{fmtMnt(payment.amount)}</td>
                          <td className="px-3 py-2">{formatFinanceDateTime(payment.timestamp)}</td>
                          <td className="px-3 py-2">
                            {fmtName(payment.createdByUser?.ovog, payment.createdByUser?.name)}
                          </td>
                          <td className="px-3 py-2">{payment.reference || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="flex justify-between py-1">
                  <span>Нийт</span>
                  <strong>{fmtMnt(total)}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span>Төлсөн</span>
                  <strong>{fmtMnt(paid)}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span>Үлдэгдэл</span>
                  <strong>{fmtMnt(remaining)}</strong>
                </div>
              </div>

              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(true)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white"
                >
                  ➕ Төлбөр оруулах
                </button>
                <button
                  type="button"
                  disabled={!canIssue || issuing || invoice.ebarimt.issued}
                  onClick={issueEbarimt}
                  className="rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700 disabled:opacity-50"
                >
                  🧾 eBarimt олгох
                </button>
                <button
                  type="button"
                  disabled={!canIssue || issuing || !invoice.ebarimt.issued}
                  onClick={reissueEbarimt}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 disabled:opacity-50"
                >
                  🔄 eBarimt дахин олгох
                </button>
                <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-400">
                  ✏️ Нэхэмжлэл засах
                </button>
                <button
                  type="button"
                  disabled={!canVoid || voiding}
                  onClick={() => setVoidConfirmOpen(true)}
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                >
                  {voiding ? "⏳ Устгаж байна..." : "❌ Нэхэмжлэл устгах"}
                </button>
              </div>
              {issueError && <p className="text-sm text-red-600">{issueError}</p>}
              {voidError && <p className="text-sm text-red-600">{voidError}</p>}
            </>
          )}
        </div>
      </div>

      {voidConfirmOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="mb-2 text-base font-semibold">Нэхэмжлэл устгах уу?</h3>
            <p className="mb-4 text-sm text-gray-600">
              Э-баримтыг буцааж, нэхэмжлэлийг хүчингүй болгоно. Үргэлжлүүлэх үү?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={voiding}
                onClick={() => setVoidConfirmOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                Болих
              </button>
              <button
                type="button"
                disabled={voiding}
                onClick={voidInvoice}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:bg-red-300"
              >
                {voiding ? "Боловсруулж байна..." : "Тийм, устгах"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddPaymentModal
        open={paymentModalOpen}
        invoiceId={invoiceId}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={onPaymentSuccess}
      />
    </>
  );
}
