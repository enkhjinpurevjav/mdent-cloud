import React from "react";
import { useRouter } from "next/router";
import NurseIncomeDetails from "../../../../components/nurses/NurseIncomeDetails";

export default function NurseIncomeDetailsPage() {
  const router = useRouter();
  const { nurseId, startDate, endDate } = router.query as {
    nurseId?: string;
    startDate?: string;
    endDate?: string;
  };

  const ready = router.isReady && !!nurseId && !!startDate && !!endDate;

  return (
    <main className="p-6 font-sans">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="py-1.5 px-3.5 text-sm rounded-lg border border-gray-300 bg-white cursor-pointer hover:bg-gray-50"
        >
          ← Буцах
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-1">
        Сувилагчийн орлогын дэлгэрэнгүй
      </h1>
      {startDate && endDate && (
        <div className="text-sm text-gray-500 mb-5">
          {startDate} — {endDate}
        </div>
      )}

      {!ready ? (
        <p className="text-gray-500">Параметр дутуу байна.</p>
      ) : (
        <NurseIncomeDetails
          nurseId={Number(nurseId)}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </main>
  );
}
