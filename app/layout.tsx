import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Suivi de production · maquette de proposition',
  description:
    'Maquette de proposition — suivi des analyses spécialisées impactées. Document de travail non officiel.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {/* Bandeau obligatoire, permanent et non masquable — PRD §5.1 */}
        <div className="disclaimer" role="note">
          <b>Maquette de proposition</b> · document de travail non officiel · ne reflète pas
          l&rsquo;état réel de la production Cerba
        </div>
        {children}
      </body>
    </html>
  );
}
