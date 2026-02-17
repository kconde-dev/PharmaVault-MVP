import { ShieldCheck, Wallet, Receipt, CreditCard, FileCheck2, Calculator, CircleHelp, ServerCog, Fingerprint } from 'lucide-react';

export function About() {
  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-slate-900" title="PharmaVault : Maîtrise Financière & Anti-Coulage">
            PharmaVault : Maîtrise Financière & Anti-Coulage
          </h1>
          <span
            title="Cet écran explique la logique technique: souveraineté locale, audit financier et formules de contrôle."
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600"
          >
            <CircleHelp className="h-4 w-4" />
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-7 mt-3">
          Un système de gestion de flux de trésorerie conçu pour les officines de Conakry.
          PharmaVault sécurise chaque transaction, suit vos créances et automatise votre comptabilité journalière.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-cyan-700" />
            <h3 className="text-lg font-black text-cyan-900">Souveraineté Technique: Local Node</h3>
          </div>
          <p className="mt-3 text-sm leading-7 text-cyan-900/90">
            PharmaVault Pro déploie un nœud local dans l&apos;officine. Si le câble sous-marin de Conakry est coupé,
            la base locale continue de traiter ventes, dépenses et crédits sans interruption. La synchronisation cloud
            reprend automatiquement au retour du réseau.
          </p>
          <p className="mt-2 text-sm leading-7 text-cyan-900/90">
            Mini-Serveur Local: SSD industriel, ventilation renforcée, alimentation stabilisée et monitoring thermique
            pour fonctionnement 24/7 dans les environnements chauds de Conakry.
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-emerald-700" />
            <h3 className="text-lg font-black text-emerald-900">Zero-Leak Logic: Audit Trail</h3>
          </div>
          <p className="mt-3 text-sm leading-7 text-emerald-900/90">
            Chaque GNF est rattaché à un ID transaction unique, un horodatage précis et un profil utilisateur identifié.
            L&apos;administrateur peut reconstituer toute opération: qui a créé, modifié ou validé une écriture.
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">
            Séquençage Strict : Pour éviter les fuites de capitaux, une seule personne peut être responsable du coffre à la fois. L&apos;administrateur garde le contrôle total pour débloquer le système en cas d&apos;oubli de clôture.
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3 text-slate-100">
          <ShieldCheck className="h-6 w-6 text-emerald-300" />
          <h2 className="text-xl font-black">Piliers Financiers</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <Receipt className="h-5 w-5 text-cyan-300" />
            <p className="mt-2 text-sm font-bold text-white">Recettes Sécurisées</p>
            <p className="text-xs text-slate-300">
              Enregistrement de chaque vente (Espèces, Orange Money) avec horodatage et identifiant caissier.
            </p>
          </article>
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <CreditCard className="h-5 w-5 text-amber-300" />
            <p className="mt-2 text-sm font-bold text-white">Suivi des Dettes (Crédits)</p>
            <p className="text-xs text-slate-300">
              Ne perdez plus jamais une créance. Enregistrez le nom et le téléphone des clients pour un recouvrement efficace.
            </p>
          </article>
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <Wallet className="h-5 w-5 text-emerald-300" />
            <p className="mt-2 text-sm font-bold text-white">Gestion des Dépenses</p>
            <p className="text-xs text-slate-300">
              Sorties de caisse (transport, fournitures) documentées pour éviter les trous inexpliqués.
            </p>
          </article>
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <FileCheck2 className="h-5 w-5 text-indigo-300" />
            <p className="mt-2 text-sm font-bold text-white">Partage Assurance</p>
            <p className="text-xs text-slate-300">
              Calcul instantané du split Patient/Assurance (CNAMGS, NSIA, etc.) pour éviter les erreurs de calcul manuel.
            </p>
          </article>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Recettes & Dépenses</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-7">
            <li className="flex items-start gap-2"><Wallet className="mt-1 h-4 w-4 text-slate-500" />Suivi du solde en temps réel.</li>
            <li className="flex items-start gap-2"><Receipt className="mt-1 h-4 w-4 text-slate-500" />Historique des entrées et sorties de caisse.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm">
          <h3 className="text-lg font-black text-emerald-900">Assurance & Créances</h3>
          <ul className="mt-3 space-y-2 text-sm text-emerald-900 leading-7">
            <li className="flex items-start gap-2"><ShieldCheck className="mt-1 h-4 w-4 text-emerald-700" />Mode Assurance: calcul automatique de la part patient et part assurance.</li>
            <li className="flex items-start gap-2"><CreditCard className="mt-1 h-4 w-4 text-emerald-700" />Suivi des Créances: liste claire des montants dus par client.</li>
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-700" />
          <h3 className="text-lg font-black text-amber-900">Comment PharmaVault calcule votre Bilan</h3>
        </div>
        <div className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-3">
          <p className="text-sm font-black text-amber-900">
            $$Espèces\ Finales = (Fond\ de\ Caisse + Recettes\ Cash) - Dépenses$$
          </p>
        </div>
        <p className="mt-3 text-sm leading-7 text-amber-900/90">
          Le système compare ce montant théorique avec ce que le caissier compte physiquement dans le tiroir à la fin de la garde.
        </p>
      </section>

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
        <h3 className="text-lg font-black text-indigo-900">Module Dépenses: Catégories de Motif</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-indigo-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-700">Logistique</p>
            <p className="mt-1 text-sm text-slate-700">Carburant, transport livraison.</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-700">Fournitures</p>
            <p className="mt-1 text-sm text-slate-700">Papier ticket, nettoyage.</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-700">Personnel</p>
            <p className="mt-1 text-sm text-slate-700">Avance sur salaire, repas de garde.</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-700">Maintenance</p>
            <p className="mt-1 text-sm text-slate-700">Réparation clim, électricité.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Problèmes courants & réponses PharmaVault</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4 font-black">Problème</th>
                <th className="pb-3 font-black">Solution PharmaVault</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 font-semibold">Argent manquant</td>
                <td className="py-3">Chaque dépense doit être enregistrée avant toute sortie de caisse.</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 font-semibold">Dettes oubliées</td>
                <td className="py-3">Le tableau Suivi des Dettes garde les montants impayés visibles en permanence.</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 font-semibold">Calculs lents</td>
                <td className="py-3">Le partage Assurance/Patient est calculé automatiquement dans le terminal.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Erreurs manuelles</td>
                <td className="py-3">La formule de fin de garde supprime l&apos;approximation et sécurise le contrôle propriétaire.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-5">
        <p className="text-xs text-slate-500">PharmaVault : Votre argent, sous votre contrôle.</p>
      </footer>
    </div>
  );
}

export default About;
