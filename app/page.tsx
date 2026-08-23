import { cookies } from 'next/headers';
import { demoCookieValide, demoLockActif, DEMO_COOKIE } from '@/lib/demo-lock';
import { Consultation } from './components/Consultation';
import { DemoGate } from './components/DemoGate';

export const dynamic = 'force-dynamic';

/**
 * CONSULTATION — lecture seule, temps réel.
 * Phase proposition : verrouillée par DEMO_PASSWORD (PRD §5.1). Le verrou est
 * entièrement isolé dans lib/demo-lock.ts : supprimer la variable
 * d'environnement DEMO_PASSWORD suffit à rendre la page publique.
 */
export default async function PageConsultation() {
  if (demoLockActif()) {
    const jar = await cookies();
    if (!demoCookieValide(jar.get(DEMO_COOKIE)?.value)) {
      return <DemoGate />;
    }
  }
  return <Consultation />;
}
