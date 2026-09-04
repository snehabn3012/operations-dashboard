import { ReactNode } from "react";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import styles from "./AppShell.module.css";

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export default function AppShell({ title, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Header title={title} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
