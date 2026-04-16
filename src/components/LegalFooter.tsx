import Link from 'next/link';

export default function LegalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto py-6 px-4 text-center text-xs text-slate-600 space-y-1">
      <p>
        <Link href="/privacidad" className="hover:text-slate-400 transition-colors underline-offset-2 hover:underline">
          Política de Privacidad
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terminos" className="hover:text-slate-400 transition-colors underline-offset-2 hover:underline">
          Términos y Condiciones
        </Link>
      </p>
      <p>© {year} Baúl Digital · Protegido bajo Ley 1581 de 2012 (Colombia)</p>
    </footer>
  );
}
