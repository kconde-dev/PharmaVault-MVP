import { BellRing, ShieldAlert, Siren, ScanLine } from 'lucide-react';

export function SafeGuardSolution() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="SafeGuard Security">
          SafeGuard Security : Zéro Démarque Inconnue
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Le vol à l&apos;étalage n&apos;est plus une fatalité. SafeGuard lie votre inventaire PharmaVault à des barrières
          physiques. Un produit sort sans être payé ? L&apos;alarme retentit, une notification est envoyée.
          C&apos;est la technologie au service de votre sérénité.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-rose-600" />
          <h2 className="text-xl font-black text-slate-900">Stop Shoplifting avec intégration EAS</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          SafeGuard intègre des portiques physiques EAS aux sorties. Lorsqu&apos;un article non payé traverse la zone,
          le système déclenche une réponse immédiate: alarme locale, signal visuel, et alerte mobile pour l&apos;admin.
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
    </div>
  );
}

export default SafeGuardSolution;
