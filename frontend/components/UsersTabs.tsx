import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function UsersTabs() {
  const router = useRouter();
  const path = router.pathname; // e.g. "/users", "/users/doctors", "/users/reception"

  const isActive = (href: string) => {
    // simple match: exact path
    return path === href;
  };

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "8px 16px",
    textDecoration: "none",
    borderBottom: active ? "3px solid #2563eb" : "3px solid transparent",
    color: active ? "#2563eb" : "#2563eb",
    fontWeight: active ? 600 : 400,
  });

  return (
    <nav>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 16px 0",
          display: "flex",
          gap: 8,
          borderBottom: "1px solid #ddd",
        }}
      >
        <li>
          <Link href="/users" legacyBehavior>
            <a style={linkStyle(isActive("/users"))}>Бүгд</a>
          </Link>
        </li>
        <li>
          <Link href="/users/doctors" legacyBehavior>
            <a style={linkStyle(isActive("/users/doctors"))}>Эмч</a>
          </Link>
        </li>
        <li>
          <Link href="/users/reception" legacyBehavior>
            <a style={linkStyle(isActive("/users/reception"))}>Ресепшн</a>
          </Link>
        </li>
        <li>
          <Link href="/users/nurses" legacyBehavior>
            <a style={linkStyle(isActive("/users/nurses"))}>Сувилагч</a>
          </Link>
        </li>
        <li>
          <Link href="/users/staff" legacyBehavior>
            <a style={linkStyle(isActive("/users/staff"))}>Бусад ажилтан</a>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
