import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inside Arc Agent Army',
  description: 'AI agent dashboard for Inside Arc',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
