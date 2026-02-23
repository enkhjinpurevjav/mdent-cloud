import type { AppProps } from "next/app";
import AdminLayout from "../components/AdminLayout";
import { useRouter } from "next/router";

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isPublicRoute = router.pathname.startsWith("/online");

  if (isPublicRoute) {
    return <Component {...pageProps} />;
  }

  return (
    <AdminLayout>
      <Component {...pageProps} />
    </AdminLayout>
  );
}
