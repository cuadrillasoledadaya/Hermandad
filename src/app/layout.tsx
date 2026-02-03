import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SidebarWrapper } from "@/components/layout/sidebar-wrapper";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/ui/offline-banner";

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
  maximumScale: 5, // Permitimos zoom para accesibilidad
  userScalable: true, // Permitimos zoom para accesibilidad
};

// ELIMINADO: export const dynamic = "force-dynamic";
// Ahora las páginas pueden usar SSG por defecto

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Iconos para iOS */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <SidebarWrapper>
              {children}
            </SidebarWrapper>
            <OfflineBanner />
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
