import { useState } from 'react';
import { ArrowRight, Crown, MapPinned, ShieldAlert, Timer, WifiOff, BrainCircuit, DatabaseZap, X, CircleHelp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { openBizmapSupportChat } from '@/lib/bizmapSupport';

type SolutionKey = 'google' | 'safeguard' | 'terminal' | 'pro';

export function OtherApps() {
  const [activeModal, setActiveModal] = useState<SolutionKey | null>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-slate-900" title="L'Écosystème BIZMAP : La Puissance Digitale pour votre Pharmacie">
            L&apos;Écosystème BIZMAP : La Puissance Digitale pour votre Pharmacie
          </h1>
          <span
            title="Cette page présente les leviers de croissance: performance caisse, visibilité Google et sécurité anti-perte."
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700"
          >
            <CircleHelp className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-700">
          Pensé pour les officines de Conakry, cet écosystème transforme votre pharmacie en business suite moderne:
          encaissement rapide, paiements Orange Money, pilotage des Pharmacies de Garde, visibilité Google et sécurité magasin.
        </p>
      </header>

      <section className="rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 p-6 shadow-2xl shadow-emerald-500/10">
        <div className="flex items-center gap-3">
          <Timer className="h-6 w-6 text-emerald-300" />
          <h2 className="text-lg font-black text-white">High-Speed Terminal: Cockpit Caissier</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-200">
          Le standard haute performance 2026 pour les opérations en officine à Conakry:
          <span className="font-black text-emerald-200"> validation visuelle</span> avant encaissement,
          <span className="font-black text-emerald-200"> calculateur de monnaie</span> intégré et traçabilité par caissier.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Résultat: moins d&apos;erreurs de caisse, plus de vitesse en heure de pointe, meilleure discipline opérationnelle.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveModal('terminal')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-100 hover:bg-slate-700/40"
          >
            Voir la fiche pro
          </button>
          <button
            type="button"
            onClick={() => setIsContactOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-emerald-300"
          >
            Demander un Devis
          </button>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 shadow-2xl shadow-amber-500/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-amber-300" />
            <h2 className="text-lg font-black text-white">PharmaVault Pro: Premium Upgrade (Legacy Killer)</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            PharmaVault Standard vous dit où part votre argent aujourd&apos;hui.
            <span className="font-black text-amber-200"> PharmaVault Pro</span> vous donne un pilotage temps réel de demain:
            trésorerie, stock, assurance, crédits et performance opérationnelle.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            C&apos;est un système complet de gestion officinale, version moderne: meilleur suivi de stock, meilleure
            traçabilité financière et meilleure résilience technique qu&apos;un logiciel legacy classique.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-cyan-200">
                <WifiOff className="h-4 w-4" />
                Serveur Privé (Souveraineté)
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                Votre pharmacie continue de vendre même en cas de coupure internet nationale.
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                Mini-Serveur local optimisé 24/7: SSD industriel, refroidissement renforcé et stabilité haute température.
              </p>
            </article>
            <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-emerald-200">
                <BrainCircuit className="h-4 w-4" />
                Alertes SMS & IA
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                Le propriétaire reçoit des alertes proactives sur anomalies de stock, écarts de caisse et risques de rupture.
              </p>
            </article>
            <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-amber-200">
                <DatabaseZap className="h-4 w-4" />
                Migration Zero-Effort
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                Import direct de vos données legacy vers PharmaVault Pro sans interruption de service.
              </p>
            </article>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveModal('pro')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-100 hover:bg-slate-700/40"
            >
              Voir la fiche pro
            </button>
            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300"
            >
              Demander un Devis
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-900/20 p-3">
            <p className="text-xs font-black uppercase tracking-wider text-amber-100">Roadmap Pro</p>
            <p className="mt-1 text-xs leading-6 text-slate-300">
              Migration Mode: nous ne supprimons pas votre ancien logiciel, nous mappons les anciennes tables SQL vers
              le schéma moderne PharmaVault pour une transition sans perte.
            </p>
            <p className="mt-1 text-xs leading-6 text-slate-300">
              Résultat: continuité de service immédiate, reprise historique propre et exploitation des données existantes
              sans ressaisie manuelle.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3">
          <MapPinned className="h-6 w-6 text-cyan-300" />
          <h2 className="text-lg font-black text-white">SEO & Google Maps</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          <span className="font-black text-cyan-200">Devenez le N°1 sur Google Maps à Conakry.</span> Nous optimisons
          votre fiche pour capter le trafic local, surtout lors des recherches &quot;pharmacie de garde&quot;.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Impact direct: plus d&apos;appels, plus d&apos;itinéraires, plus de clients en comptoir.
        </p>
        <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-900/20 p-3">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-100">Stratégie Top 3 Pack</p>
          <p className="mt-1 text-xs leading-6 text-slate-300">
            1) Optimisation GMB (catégories, horaires, photos, services), 2) gestion active des avis et réponses,
            3) ciblage mots-clés de proximité: pharmacie ouverte maintenant, pharmacie de garde, ordonnance urgente, Orange Money.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveModal('google')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-100 hover:bg-slate-700/40"
          >
            Voir la fiche pro
          </button>
          <button
            type="button"
            onClick={() => setIsContactOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/20"
          >
            Me Contacter
          </button>
          <Link
            to="/dashboard/solutions/google-maps"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
          >
            Voir les détails
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-rose-300" />
          <h2 className="text-lg font-black text-white">SafeGuard EAS</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          <span className="font-black text-rose-200">Zéro Vol à l&apos;Étalage.</span> SafeGuard relie la sécurité physique
          (portiques EAS) au suivi digital des mouvements, pour protéger vos rayons et votre marge.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Si un article non validé franchit la sortie, alerte immédiate et journalisation automatique côté admin.
        </p>
        <div className="mt-3 rounded-xl border border-rose-300/30 bg-rose-900/20 p-3">
          <p className="text-xs font-black uppercase tracking-wider text-rose-100">Hardware-Software Handshake</p>
          <p className="mt-1 text-xs leading-6 text-slate-300">
            Si un code-barres n&apos;est pas scanné en caisse, la porte EAS déclenche l&apos;alerte et PharmaVault crée une entrée
            d&apos;incident horodatée avec identifiant utilisateur pour audit immédiat.
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-300">
            Technologie RF/AM intégrée: chaque alarme devient un point de données exploitable dans le dashboard.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveModal('safeguard')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-100 hover:bg-slate-700/40"
          >
            Voir la fiche pro
          </button>
          <button
            type="button"
            onClick={() => setIsContactOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/20"
          >
            Demander un Devis
          </button>
          <Link
            to="/dashboard/solutions/safeguard"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
          >
            Voir les détails
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Le Narratif Legacy Killer</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4 font-black">Service</th>
                <th className="pb-3 font-black">Valeur Propriétaire</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 font-semibold">PharmaVault (Standard)</td>
                <td className="py-3">&quot;Je sais où part mon argent aujourd&apos;hui.&quot;</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 font-semibold">PharmaVault Pro</td>
                <td className="py-3">&quot;Je possède mes données et mon système me dit quoi faire demain.&quot;</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 pr-4 font-semibold">Google Maps SEO</td>
                <td className="py-3">&quot;Ma pharmacie est pleine parce qu&apos;on me trouve sur téléphone.&quot;</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">SafeGuard</td>
                <td className="py-3">&quot;Je dors tranquille, mes rayons sont électroniquement protégés.&quot;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {activeModal === 'terminal'
                  ? 'Cockpit Caissier - High-Speed Terminal'
                  : activeModal === 'pro'
                    ? 'PharmaVault Pro - Premium Upgrade'
                    : activeModal === 'google'
                      ? 'SEO & Google Maps - Conakry'
                      : 'SafeGuard EAS - Sécurité Officine'}
              </h3>
              <button type="button" onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-7 text-slate-700">
              {activeModal === 'terminal' && (
                <>
                  <p><strong>Standard 2026:</strong> validation visuelle, calculateur de monnaie et vitesse d&apos;encaissement maximale.</p>
                  <p><strong>Contexte Guinéen:</strong> optimisé pour les heures de pointe en pharmacie de garde et les paiements Orange Money.</p>
                </>
              )}
              {activeModal === 'pro' && (
                <>
                  <p><strong>Souveraineté:</strong> serveur privé local pour continuer à vendre même en cas de coupure internet.</p>
                  <p><strong>Pilotage:</strong> alertes SMS & IA pour signaler les anomalies de stock, de trésorerie et de crédits clients.</p>
                  <p><strong>Système complet:</strong> gestion moderne unifiée de la caisse, du stock, des assurances et des dettes.</p>
                  <p><strong>Transition:</strong> migration Zero-Effort depuis vos outils legacy, sans interruption de service.</p>
                </>
              )}
              {activeModal === 'google' && (
                <>
                  <p><strong>Objectif:</strong> apparaître en priorité sur Google Maps à Conakry.</p>
                  <p><strong>Résultat:</strong> trafic local qualifié, appels entrants et nouveaux patients.</p>
                </>
              )}
              {activeModal === 'safeguard' && (
                <>
                  <p><strong>Zéro fuite:</strong> lien direct entre sortie magasin et validation digitale.</p>
                  <p><strong>Contrôle:</strong> incident loggé en temps réel pour audit immédiat.</p>
                </>
              )}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setIsContactOpen(true);
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700"
                >
                  Demander un Devis
                </button>
                <button
                  type="button"
                  onClick={openBizmapSupportChat}
                  className="rounded-lg border border-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-50"
                >
                  Me Contacter (WhatsApp)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Demande de Devis BIZMAP</h3>
              <button type="button" onClick={() => setIsContactOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm leading-7 text-slate-700">
              Pour un devis rapide (PharmaVault Pro, SEO Google Maps, SafeGuard ou Cockpit Caissier), contactez l&apos;équipe BIZMAP.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openBizmapSupportChat}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700"
              >
                Me Contacter sur WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setIsContactOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OtherApps;
