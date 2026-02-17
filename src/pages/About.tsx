import { Bot, HardDrive, MessageSquare, ShieldCheck, Wallet } from 'lucide-react';

export function About() {
  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="PharmaVault Pro - Souveraineté Officinale">
          PharmaVault Pro : souveraineté totale pour le propriétaire.
        </h1>
        <p className="text-sm text-slate-700 leading-7 mt-3">
          PharmaVault protège la caisse avec une logique <span className="font-bold">Zero-Leak</span>. En version Pro,
          vous ajoutez une couche stratégique propriétaire: serveur local, continuité hors ligne et alertes intelligentes en temps réel.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3 text-slate-100">
          <ShieldCheck className="h-6 w-6 text-emerald-300" />
          <h2 className="text-xl font-black">Le "Pro" Sovereign Advantage</h2>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-200">
          "Your data doesn&apos;t just sit in the cloud. With PharmaVault Pro, we install a secure local node.
          If the fiber optic cable in Conakry is cut, your pharmacy keeps selling. If you want to check your stocks,
          you own the server. It&apos;s total independence."
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <HardDrive className="h-5 w-5 text-cyan-300" />
            <p className="mt-2 text-sm font-bold text-white">Serveur On-Premise Pro</p>
            <p className="text-xs text-slate-300">Nœud local sécurisé installé chez le propriétaire de l&apos;officine.</p>
          </article>
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <MessageSquare className="h-5 w-5 text-emerald-300" />
            <p className="mt-2 text-sm font-bold text-white">Alertes SMS Propriétaire</p>
            <p className="text-xs text-slate-300">Alertes critiques envoyées directement au numéro du propriétaire.</p>
          </article>
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <Bot className="h-5 w-5 text-amber-300" />
            <p className="mt-2 text-sm font-bold text-white">Alertes IA Exclusives Pro</p>
            <p className="text-xs text-slate-300">Détection proactive d&apos;anomalies stock/caisse avec notification immédiate.</p>
          </article>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Fonctionnalités Standard</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-7">
            <li className="flex items-start gap-2"><Wallet className="mt-1 h-4 w-4 text-slate-500" />Traçabilité complète des ventes, dépenses et retours.</li>
            <li className="flex items-start gap-2"><ShieldCheck className="mt-1 h-4 w-4 text-slate-500" />Journal d&apos;audit et contrôle des validations sensibles.</li>
            <li className="flex items-start gap-2"><MessageSquare className="mt-1 h-4 w-4 text-slate-500" />Reporting opérationnel centralisé.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm">
          <h3 className="text-lg font-black text-emerald-900">Exclusivités PharmaVault Pro (Owner)</h3>
          <ul className="mt-3 space-y-2 text-sm text-emerald-900 leading-7">
            <li className="flex items-start gap-2"><HardDrive className="mt-1 h-4 w-4 text-emerald-700" />Serveur On-Premise dédié au propriétaire.</li>
            <li className="flex items-start gap-2"><MessageSquare className="mt-1 h-4 w-4 text-emerald-700" />Alertes SMS automatiques vers le propriétaire.</li>
            <li className="flex items-start gap-2"><Bot className="mt-1 h-4 w-4 text-emerald-700" />Alertes IA de supervision réservées au pack Pro.</li>
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h3 className="text-lg font-black text-amber-900">Crédits Clients & Advantage Pro</h3>
        <p className="mt-3 text-sm leading-7 text-amber-900/90">
          PharmaVault Pro gère vos crédits clients avec précision. Recevez des alertes SMS pour les dettes non soldées
          et suivez vos créances en un clic.
        </p>
        <p className="mt-3 text-sm leading-7 text-amber-900/90">
          Transparence: les logiciels traditionnels perdent le suivi des dettes. PharmaVault Pro journalise chaque GNF de crédit
          avec horodatage et identifiant du caissier.
        </p>
        <p className="mt-3 text-sm leading-7 text-amber-900/90">
          Sécurité: seuls les utilisateurs autorisés peuvent valider les crédits importants pour protéger le cash-flow de l&apos;officine.
        </p>
        <p className="mt-3 text-sm leading-7 text-amber-900/90">
          L&apos;IA de PharmaVault Pro analyse l&apos;historique de vos crédits. Si un client dépasse un certain seuil de dette
          ou tarde trop à payer, le système alerte le caissier et signale un risque au propriétaire.
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-5">
        <p className="text-xs text-slate-500">PharmaVault Pro: indépendance opérationnelle, même en cas de coupure Internet nationale.</p>
      </footer>
    </div>
  );
}

export default About;
