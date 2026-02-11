import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SyncProvider } from "@/components/providers/sync-provider";
import { SidebarWrapper } from "@/components/layout/sidebar-wrapper";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { VersionMonitor } from "@/components/providers/version-monitor";
import { LoggerInitializer } from "@/components/providers/logger-initializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hermandad de la Soledad - Gestión",
  description: "Sistema de gestión integral para la Hermandad",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hermandad",
  },
};

export const viewport: Viewport = {
  themeColor: "#2E7D32",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log('>>> [DEBUG] ROOT LAYOUT RENDERING ON SERVER');

  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <SyncProvider>
              <SidebarWrapper>
                {children}
              </SidebarWrapper>
              <OfflineBanner />
              <Toaster />
              <VersionMonitor />
              <LoggerInitializer />
            </SyncProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
