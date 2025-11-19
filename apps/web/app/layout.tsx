import type { Metadata } from "next";
import { Inter, Urbanist } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import Header from "@/components/Header";
import ChainSwitcher from "@/components/ChainSwitcher";
import { ToastProvider } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "yesno.win - Prediction Markets",
  description: "Decentralized prediction markets platform built on blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${urbanist.variable} ${geistMono.variable} antialiased scrollbar`}
      >
        <ThirdwebProvider> 
          <ToastProvider>
            <ErrorBoundary>
              <Header />
              <ChainSwitcher />
              {children}
            </ErrorBoundary>
          </ToastProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
