"use client";

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

// Metadata moved to head tags since we're using "use client"
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>yesno.win - Prediction Markets</title>
        <meta name="description" content="Decentralized prediction markets platform built on blockchain" />
      </head>
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
