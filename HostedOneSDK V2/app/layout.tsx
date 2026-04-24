import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ACME Ltd - Account Verification",
  description: "Complete your identity verification with ACME Ltd",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="bg-yellow-400 text-black text-center text-xs font-semibold px-4 py-2">
          This is not the FrankieOne out of the box product. It is a vibe coded example of what is possible with our SDKs that Clients could build on their side.
        </div>
        {children}
      </body>
    </html>
  );
}
