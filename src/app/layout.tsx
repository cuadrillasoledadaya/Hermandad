import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SidebarWrapper } from "@/components/layout/sidebar-wrapper";
import { Toaster } from "@/components/ui/sonner";

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
  maximumScale: 1,
  userScalable: false,
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased pb-20`}>
        <QueryProvider>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <SidebarWrapper>
                <main className="flex-1 p-4 lg:pl-64">
                  {children}
                </main>
              </SidebarWrapper>
              <Toaster />
            </div>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
