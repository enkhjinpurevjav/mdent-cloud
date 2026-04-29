import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ClinicReportRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/reports/main");
  }, [router]);

  return null;
}
