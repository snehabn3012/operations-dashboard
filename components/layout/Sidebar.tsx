"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/configure", label: "Configure", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>OM</span>
        <span className={styles.brandName}>Operations Manager</span>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`${styles.link} ${active ? styles.linkActive : ""}`}>
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.linkLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
