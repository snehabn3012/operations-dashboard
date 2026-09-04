import type { Metadata } from "next";
import type { ReactNode } from "react";

import StoreProvider from "@/store/StoreProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Operations Dashboard",
  description: "Configuration-driven operations dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
