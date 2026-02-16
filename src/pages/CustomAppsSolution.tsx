import { Building2, Code2, Truck, ShoppingBag, Building } from 'lucide-react';

export function CustomAppsSolution() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="Développement sur-mesure">
          Développement Sur-Mesure : Votre Vision, Notre Code
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Chaque business est unique. Que vous ayez besoin d&apos;une application de livraison,
          d&apos;un système de gestion de paie ou d&apos;un portail client, BIZMAP conçoit des solutions robustes,
          prêtes pour l&apos;IA, adaptées aux réalités du marché africain.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Code2 className="h-6 w-6 text-blue-700" />
          <h2 className="text-xl font-black text-slate-900">Logiciels métiers taillés pour votre croissance</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          BIZMAP développe des plateformes web et mobiles sur mesure pour Logistics, Retail et Real Estate,
          avec une architecture évolutive, des tableaux de bord exploitables et des workflows automatisés.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Truck className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-sm font-bold text-slate-900">Logistics</p>
            <p className="text-xs text-slate-600">Suivi de flotte, distribution, livraisons et preuves terrain.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <ShoppingBag className="h-5 w-5 text-cyan-700" />
            <p className="mt-2 text-sm font-bold text-slate-900">Retail</p>
            <p className="text-xs text-slate-600">Encaissement, stock, promotions, fidélité et reporting.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Building className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-sm font-bold text-slate-900">Real Estate</p>
            <p className="text-xs text-slate-600">Gestion locative, relances, contrats et portail propriétaire.</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Processus "Made in Guinea" pour PME</h3>
        <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
          <p><strong>1. Diagnostic terrain:</strong> immersion métier sur vos flux réels (caisse, stock, opérations) pour supprimer les points de friction.</p>
          <p><strong>2. Conception locale:</strong> UX en français, logique adaptée aux usages guinéens, et intégration des paiements locaux.</p>
          <p><strong>3. Déploiement progressif:</strong> livraison par modules, formation des équipes, support continu et améliorations pilotées par vos résultats.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5">
        <div className="flex items-center gap-3 text-slate-100">
          <Building2 className="h-5 w-5 text-emerald-300" />
          <p className="text-sm font-semibold">Déploiement progressif, impact mesurable, maintenance continue.</p>
        </div>
      </section>
    </div>
  );
}

export default CustomAppsSolution;
