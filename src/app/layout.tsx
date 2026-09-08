import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Verifin — KYC/AML Compliance Platform',
  description: 'Verifin: AI-assisted KYC/AML compliance investigation and review platform.',
  icons: {
    icon: [
      {
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 2 L36 8 V19 C36 28.5 29.5 35.5 20 38 C10.5 35.5 4 28.5 4 19 V8 L20 2 Z" fill="#4f46e5"/><path d="M12 19.5 L18 26 L29 12.5" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
          ),
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
