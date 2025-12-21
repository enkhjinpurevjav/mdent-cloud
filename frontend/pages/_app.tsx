import type { AppProps } from "next/app";
import AdminLayout from "../components/AdminLayout";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AdminLayout>
      <Component {...pageProps} />
    </AdminLayout>
  );
}
