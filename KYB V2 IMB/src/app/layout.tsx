import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IMB Bank — Business Onboarding',
  description: 'IMB Bank business (KYB) onboarding portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
