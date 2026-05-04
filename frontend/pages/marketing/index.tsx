import { useEffect } from "react";
import { useRouter } from "next/router";

export default function MarketingIndexPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/marketing/appointments");
  }, [router]);

  return null;
}
