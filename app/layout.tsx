import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Sunnybunch · Studio", description: "Private Sunnybunch store management", robots: { index: false, follow: false }, icons: { icon: "/assets/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
