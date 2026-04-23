import type { Metadata } from "next";
import { NotificationBridge } from "@/components/notification-bridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "Find A Partner",
  description: "Meet real nearby people, match, chat, and build meaningful connections.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <NotificationBridge />
      </body>
    </html>
  );
}
