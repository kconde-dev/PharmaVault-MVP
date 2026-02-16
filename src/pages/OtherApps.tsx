import { useState } from 'react';
import { ArrowRight, MapPinned, ShieldAlert, Wrench, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { openBizmapSupportChat } from '@/lib/bizmapSupport';

type SolutionKey = 'google' | 'custom' | 'safeguard';

export function OtherApps() {
  const [activeModal, setActiveModal] = useState<SolutionKey | null>(null);

  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="L'écosystème BIZMAP">
          L&apos;Écosystème BIZMAP : Croissance Digitale pour l&apos;Afrique.
        </h1>
        <p className="text-sm text-slate-700 leading-7 mt-3" title="Mission BIZMAP">
          Aider chaque entreprise en Afrique à grandir. À l&apos;ère de l&apos;IA, les PME sont le moteur de l&apos;économie et
          BIZMAP s&apos;assure qu&apos;elles disposent des meilleurs outils.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">BIZMAP Ecosystem</h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Une suite complète de solutions terrain pour la croissance des entreprises guinéennes:
          visibilité, sécurité opérationnelle et automatisation métier.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Plus qu&apos;un logiciel, c&apos;est votre bras droit: PharmaVault sécurise vos revenus, gère vos assurances
          et vous envoie votre bilan chaque soir par WhatsApp.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3">
          <MapPinned className="h-6 w-6 text-cyan-300" />
          <h3 className="text-lg font-black text-white">Google Maps & SEO (Propulsez votre visibilité)</h3>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          80% des clients à Conakry utilisent Google Maps pour trouver une pharmacie de garde.
          BIZMAP ne se contente pas de vous lister ; nous optimisons votre Business Profile pour vous placer
          dans le Top 3.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Notre stratégie SEO locale combine structure sémantique, avis clients et optimisation d&apos;intentions de recherche
          pour capter durablement le trafic physique à Conakry.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Résultat : plus d&apos;appels, plus d&apos;itinéraires, et votre Code Marchand Orange Money visible
          directement pour des pré-paiements rapides.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Votre officine devient le premier choix client quand quelqu&apos;un tape "Pharmacie" à Conakry.
        </p>
        <button
          type="button"
          onClick={() => setActiveModal('google')}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-700/40"
        >
          Voir la fiche pro
        </button>
        <button
          type="button"
          onClick={openBizmapSupportChat}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/20"
        >
          Me Contacter
        </button>
        <Link
          to="/dashboard/solutions/google-maps"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
          title="Voir les détails - Google Maps & SEO"
        >
          Voir les détails
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-rose-300" />
          <h3 className="text-lg font-black text-white">SafeGuard Security (La fin du vol à l&apos;étalage)</h3>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          PharmaVault surveille vos chiffres, SafeGuard surveille vos rayons. Intégré nativement à PharmaVault,
          SafeGuard utilise des portiques EAS intelligents reliés à la synchronisation d&apos;inventaire.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Si un produit non-validé en caisse franchit la sortie, une alerte retentit et l&apos;incident est loggé
          instantanément sur le tableau de bord Admin. Zéro perte, sécurité totale.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          SafeGuard se rembourse rapidement en supprimant les pertes "mystères" qui grignotent votre marge mois après mois.
        </p>
        <button
          type="button"
          onClick={() => setActiveModal('safeguard')}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-700/40"
        >
          Voir la fiche pro
        </button>
        <button
          type="button"
          onClick={openBizmapSupportChat}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/20"
        >
          Me Contacter
        </button>
        <Link
          to="/dashboard/solutions/safeguard"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
          title="Voir les détails - SafeGuard Security"
        >
          Voir les détails
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-amber-300" />
          <h3 className="text-lg font-black text-white">Développement Sur-Mesure (Votre avantage concurrentiel)</h3>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Chaque entreprise a ses secrets. BIZMAP crée des solutions logicielles (Web & Mobile) sur mesure
          qui automatisent vos processus complexes.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Conçues pour les réalités de la Guinée (connectivité, opérations terrain, paiements locaux),
          nos solutions vous donnent un avantage concurrentiel durable grâce à une Agilité Africaine assumée
          et des intégrations de paiement sécurisées.
        </p>
        <button
          type="button"
          onClick={() => setActiveModal('custom')}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-700/40"
        >
          Voir la fiche pro
        </button>
        <button
          type="button"
          onClick={openBizmapSupportChat}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/20"
        >
          Me Contacter
        </button>
        <Link
          to="/dashboard/solutions/custom-apps"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
          title="Voir les détails - Développement Sur-Mesure"
        >
          Voir les détails
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm leading-7 text-slate-700">
          Le futur de l&apos;Afrique est digital, construisons-le ensemble.
        </p>
      </section>

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {activeModal === 'google'
                  ? 'Visibilité Google Maps: L’Autoroute du Client'
                  : activeModal === 'custom'
                    ? 'Développement Sur-Mesure: Votre avantage concurrentiel'
                    : 'SafeGuard Security: Protection Physique'}
              </h3>
              <button type="button" onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeModal === 'google' && (
              <div className="space-y-3 text-sm leading-7 text-slate-700">
                <p><strong>Problème:</strong> 80% des clients à Conakry utilisent Google Maps pour trouver une pharmacie de garde.</p>
                <p><strong>Solution:</strong> BIZMAP optimise votre référencement local pour vous placer dans le Top 3, avec SEO local, optimisation de fiche, avis et visuels.</p>
                <p><strong>Impact business:</strong> plus d&apos;appels qualifiés, plus d&apos;itinéraires, et votre Code Marchand OM visible pour réservation/paiement à distance.</p>
                <button
                  type="button"
                  onClick={openBizmapSupportChat}
                  className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700"
                >
                  Me Contacter
                </button>
              </div>
            )}

            {activeModal === 'custom' && (
              <div className="space-y-3 text-sm leading-7 text-slate-700">
                <p><strong>Approche:</strong> architecture Web & Mobile sur mesure, livrée avec une Agilité Africaine adaptée aux contraintes guinéennes.</p>
                <p><strong>Cas d’usage:</strong> logistique, immobilier, finance et automatisation de processus internes.</p>
                <p><strong>Résultat:</strong> réduction des tâches manuelles, accélération des opérations et intégrations de paiement sécurisées.</p>
                <button
                  type="button"
                  onClick={openBizmapSupportChat}
                  className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700"
                >
                  Me Contacter
                </button>
              </div>
            )}

            {activeModal === 'safeguard' && (
              <div className="space-y-3 text-sm leading-7 text-slate-700">
                <p><strong>Pitch:</strong> PharmaVault surveille vos chiffres, SafeGuard surveille vos rayons.</p>
                <p><strong>Détail:</strong> des portiques EAS intelligents détectent les sorties non autorisées et déclenchent une alerte en temps réel sur le téléphone Admin.</p>
                <p><strong>Traçabilité:</strong> chaque incident est loggé avec synchronisation d&apos;inventaire pour une réponse rapide et un audit de sécurité fiable.</p>
                <button
                  type="button"
                  onClick={openBizmapSupportChat}
                  className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700"
                >
                  Me Contacter
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OtherApps;
