import { BellRing, Boxes, ChartBarStacked, ShieldAlert, Store, Zap } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export function OtherApps() {
  const proDemoLink = buildWhatsAppLink(
    "Bonjour, je souhaite une démo de PharmaVault Pro (Gestion de Stock IA). Merci de me proposer un créneau.",
  );
  const safeGuardDemoLink = buildWhatsAppLink(
    "Bonjour, je souhaite une démo de SafeGuard Pharmacy Security (Anti-Vol Physique). Merci de me proposer un créneau.",
  );

  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="Other Solutions">Autres Solutions</h1>
        <p className="text-sm text-slate-500" title="2026 Marketplace">
          Marketplace 2026 pour transformer la pharmacie en centre de pilotage intelligent.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900" title="Marketplace Strategy">
          Pourquoi ces solutions sont stratégiques
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          PharmaVault Enterprise complète la gestion de caisse avec des modules à fort impact:
          maîtrise du stock, réduction des pertes, sécurisation des points de vente et supervision multi-sites.
          L'objectif n'est pas seulement d'enregistrer l'activité, mais d'améliorer durablement la marge opérationnelle.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20">
          <div className="flex items-center gap-3">
            <Boxes className="h-6 w-6 text-emerald-300" />
            <h2 className="text-lg font-black text-white" title="AI Inventory Management">
              PharmaVault Pro (Gestion de Stock IA)
            </h2>
          </div>
          <p className="mt-3 text-sm text-slate-200">
            Système d'inventaire complet qui remplace les logiciels legacy.
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Conçu pour les officines en croissance, PharmaVault Pro unifie ventes, mouvements de stock
            et signaux de rupture pour une chaîne d'approvisionnement fiable.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li title="Predictive Ordering">Predictive Ordering: IA de prévision basée sur l'historique des ventes.</li>
            <li title="Batch and Expiry Tracking">Batch/Expiry Tracking: alertes automatiques 3 mois avant expiration.</li>
            <li title="Multi-Site Sync">Multi-Site Sync: pilotez jusqu'à 5 pharmacies sur un écran unique.</li>
          </ul>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3">
              <ChartBarStacked className="h-4 w-4 text-emerald-300" />
              <p className="mt-1 text-xs font-bold text-slate-100">Réduction des ruptures</p>
            </div>
            <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3">
              <Store className="h-4 w-4 text-cyan-300" />
              <p className="mt-1 text-xs font-bold text-slate-100">Pilotage multi-officines</p>
            </div>
          </div>
          <a
            href={proDemoLink}
            target="_blank"
            rel="noreferrer"
            className="mt-6 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
            title="Request Demo"
          >
            Request Demo
          </a>
        </article>

        <article className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-rose-300" />
            <h2 className="text-lg font-black text-white" title="Physical Theft Prevention">
              SafeGuard Pharmacy Security (Anti-Vol Physique)
            </h2>
          </div>
          <p className="mt-3 text-sm text-slate-200 font-semibold">
            La Barrière Numérique Contre la Démarque Inconnue.
          </p>
          <p className="mt-3 text-sm text-slate-300">
            Arrêtez les pertes avant qu'elles ne franchissent la porte. SafeGuard Pharmacy Security
            combine des portiques de détection haute performance avec une intelligence de caisse.
            Si un produit est dissimulé dans un sac ou une poche sans être payé, l'alarme SafeGuard
            se déclenche et vous alerte instantanément sur votre téléphone. La fin du vol à l'étalage commence ici.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li title="EAS Gate Integration">EAS Gate Integration: capteurs électroniques installés à la sortie.</li>
            <li title="Pocket and Bag Detection">Pocket/Bag Detection: déclenchement alarme sur article non payé dissimulé.</li>
            <li title="Strobe and Siren">Strobe & Siren deterrence: dissuasion immédiate en magasin.</li>
            <li title="Mobile push alerts">Mobile Integration: push sécurité temps réel à l'admin dès incident.</li>
          </ul>
          <div className="mt-5 flex items-center gap-2 text-xs font-bold text-rose-200">
            <BellRing className="h-4 w-4" />
            Alertes instantanées téléphone + sirène locale
          </div>
          <div className="mt-3 rounded-xl border border-slate-600 bg-slate-800/70 p-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300">
              <Zap className="h-3.5 w-3.5 text-rose-300" />
              Temps de réaction
            </div>
            <p className="mt-2 text-xs text-slate-200">
              Incident détecté, alarme déclenchée, notification envoyée: chaîne d'intervention en quelques secondes.
            </p>
          </div>
          <a
            href={safeGuardDemoLink}
            target="_blank"
            rel="noreferrer"
            className="mt-6 rounded-xl bg-slate-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-white"
            title="Request Demo"
          >
            Request Demo
          </a>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900" title="Deployment Model">Déploiement Enterprise</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Les modules Pro et SafeGuard peuvent être déployés progressivement, site par site,
          avec formation des équipes et configuration sur mesure selon vos contraintes opérationnelles.
          Vous obtenez une montée en puissance contrôlée, mesurable et compatible avec vos outils existants.
        </p>
      </section>
    </div>
  );
}

export default OtherApps;
