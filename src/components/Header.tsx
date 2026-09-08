import Link from 'next/link';
import { VerifinLogo } from './Logo';

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-navy-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <VerifinLogo className="h-8 w-8" />
          <div>
            <span className="text-lg font-semibold tracking-tight text-white">Verifin</span>
            <span className="ml-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              Compliance Platform
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-300">
          <Link href="/" className="hover:text-white">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
