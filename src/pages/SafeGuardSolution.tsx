import { BellRing, ShieldAlert, Siren, ScanLine } from 'lucide-react';

export function SafeGuardSolution() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="SafeGuard Security">
          SafeGuard Security (Détails)
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          La fin de la démarque inconnue.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-rose-600" />
          <h2 className="text-xl font-black text-slate-900">Intégration EAS + PharmaVault</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Les portiques physiques EAS communiquent en temps réel avec PharmaVault.
          Si un flacon de sirop est emporté sans passage en caisse, SafeGuard déclenche l&apos;alerte et enregistre
          l&apos;incident dans le rapport de sécurité de l&apos;officine.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <ScanLine className="h-5 w-5 text-cyan-700" />
            <p className="mt-2 text-sm font-bold text-slate-900">Barrières EAS</p>
            <p className="text-xs text-slate-600">Détection physique en sortie pour bloquer les pertes.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Siren className="h-5 w-5 text-rose-600" />
            <p className="mt-2 text-sm font-bold text-slate-900">Alarme instantanée</p>
            <p className="text-xs text-slate-600">Réaction immédiate en magasin pour stopper l&apos;incident.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <BellRing className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-sm font-bold text-slate-900">Notification admin</p>
            <p className="text-xs text-slate-600">Alerte mobile en temps réel pour supervision continue.</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Prévention Vol Physique: Détail Opérationnel</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Stoppez la démarque inconnue avant qu&apos;elle ne dégrade votre marge. SafeGuard n&apos;est pas un simple portique:
          c&apos;est un auditeur temps réel relié à PharmaVault. Si un médicament sort sans passage en caisse validé,
          l&apos;alerte part immédiatement vers l&apos;admin avec le contexte de stock.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Résultat business: réduction immédiate des pertes invisibles et retour sur investissement accéléré,
          avec un système qui peut s&apos;amortir en quelques mois lorsque les vols récurrents sont éliminés.
        </p>
      </section>
    </div>
  );
}

export default SafeGuardSolution;
