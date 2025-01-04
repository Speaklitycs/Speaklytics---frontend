import "@/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";

import type { AppProps } from "next/app";
import Navbar from "@/components/navbar";
import { cn } from "@/lib/utils";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      // enableSystem
      disableTransitionOnChange
    >
      <div className={cn(GeistSans.className, "flex flex-col min-h-screen")}>
        <Navbar />
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
}
