import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KYB Portal — Business Onboarding',
  description: 'Know Your Business onboarding portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <div className="bg-yellow-400 text-black text-center text-xs font-semibold px-4 py-2">
          This is not the FrankieOne out of the box product. It is a vibe coded example of what is possible with our APIs that Clients could build on their side.
        </div>
        {children}
      </body>
    </html>
  );
}
