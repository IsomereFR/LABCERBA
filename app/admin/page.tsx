import type { Metadata } from 'next';
import { Admin } from '../components/Admin';

export const metadata: Metadata = {
  title: 'Administration · suivi de production · maquette de proposition',
  robots: { index: false, follow: false },
};

/**
 * ADMINISTRATION — l'écran de mot de passe ci-dessous n'est qu'un portillon :
 * la protection réelle est dans /api/entrees, qui revérifie ADMIN_PASSWORD
 * à chaque écriture (401 si absent ou faux).
 */
export default function PageAdmin() {
  return <Admin />;
}
