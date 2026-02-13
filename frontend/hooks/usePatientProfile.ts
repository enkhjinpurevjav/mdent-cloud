// Hook for patient profile fetching logic

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { PatientProfileResponse } from '../types/patients';

export function usePatientProfile() {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [data, setData] = useState<PatientProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookNumber || typeof bookNumber !== "string") return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/patients/profile/by-book/${encodeURIComponent(bookNumber)}`
        );
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error((json && json.error) || "failed to load");
        }

        setData(json as PatientProfileResponse);
      } catch (err) {
        console.error(err);
        setError("Профайлыг ачааллах үед алдаа гарлаа");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [bookNumber]);

  return { data, loading, error, bookNumber, refetch: () => {
    if (bookNumber && typeof bookNumber === "string") {
      setLoading(true);
      setError("");
      fetch(`/api/patients/profile/by-book/${encodeURIComponent(bookNumber)}`)
        .then(res => res.json())
        .then(json => {
          setData(json as PatientProfileResponse);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError("Профайлыг ачааллах үед алдаа гарлаа");
          setData(null);
          setLoading(false);
        });
    }
  } };
}
