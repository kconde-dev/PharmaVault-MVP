import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BookOpen, ShieldCheck, ShieldAlert, FileText, BarChart3, ClipboardCheck, Wallet } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { useAuth } from '@/hooks/useAuth';

const tabs = [
  { id: 'staff', label: 'Espace Caissier', tooltip: 'Guide d’utilisation caissier' },
  { id: 'admin', label: 'Espace Administrateur', tooltip: 'Guide d’utilisation administrateur' },
] as const;

export function HelpCenter() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('staff');
  const helpLink = buildWhatsAppLink(
    "Bonjour, j'ai besoin d'assistance sur le Help Center PharmaVault. Merci de me contacter pour support.",
  );
  const isCashier = role?.toLowerCase() === 'cashier';

  if (isCashier) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
          <h1 className="text-3xl font-black text-slate-900" title="Guide d'Utilisation">Guide d'Utilisation</h1>
        <p className="text-sm text-slate-500" title="Operational handbook for staff and admins">
          Manuel opérationnel détaillé pour exécuter sans erreur et superviser sans angle mort.
        </p>
      </header>

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            title={tab.tooltip}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'staff' && (
        <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 space-y-6 shadow-2xl shadow-slate-400/20">
          <div className="flex items-center gap-2 text-slate-900">
            <BookOpen className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-black text-white" title="Espace Caissier">Espace Caissier</h2>
          </div>
          <p className="text-sm leading-7 text-slate-200">
            Ce parcours est conçu pour sécuriser la caisse tout en gardant un rythme rapide au comptoir.
            Suivez chaque étape dans l'ordre pour garantir la conformité financière.
          </p>
          <ol className="list-decimal pl-5 space-y-3 text-sm text-slate-200">
            <li>
              Ouvrez la journée depuis le tableau de bord et vérifiez que la session active est bien la vôtre.
            </li>
            <li>
              Enregistrez chaque vente en choisissant le mode de paiement correct (espèces, mobile, assurance).
            </li>
            <li>
              Pour les paiements assurance, traitez le split-payment correctement:
              part patient en caisse, part assurance en créance.
            </li>
            <li>
              Pour les dépenses, créez la demande et laissez-la en <strong>En Attente</strong> pour validation admin.
            </li>
            <li>
              Règle sécurité 2026: le <strong>N° Carte d&apos;Assurance</strong> est obligatoire pour toute demande de remboursement.
            </li>
            <li>
              Avant la fermeture, relisez le Journal Quotidien pour corriger les erreurs de saisie détectées.
            </li>
          </ol>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3 text-xs text-slate-200">
              <Wallet className="mb-2 h-4 w-4 text-emerald-300" />
              Bon réflexe: vérifiez 2 fois le montant avant validation finale.
            </div>
            <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3 text-xs text-slate-200">
              <ClipboardCheck className="mb-2 h-4 w-4 text-cyan-300" />
              Bon réflexe: ne laissez jamais une dépense hors workflow d'approbation.
            </div>
          </div>
        </section>
      )}

      {activeTab === 'admin' && (
        <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 space-y-6 shadow-2xl shadow-slate-400/20">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-black" title="Espace Administrateur">Espace Administrateur</h2>
          </div>
          <p className="text-sm leading-7 text-slate-200">
            L'espace admin combine gouvernance financière, contrôle des risques et décision stratégique.
          </p>
          <ol className="list-decimal pl-5 space-y-3 text-sm text-slate-200">
            <li>
              Journal d&apos;Audit: consultez les journaux SafeGuard pour analyser alertes intrusion, tentative de vol et écarts.
            </li>
            <li>
              Pilotez l'approbation/rejet des dépenses en attente pour verrouiller les sorties non autorisées.
            </li>
            <li>
              Exportez les <strong>Bordereaux d&apos;Assurance</strong> (Demandes de Remboursement) pour accélérer le règlement.
            </li>
            <li>
              Pilotage décisionnel: exploitez le tableau d&apos;analyse pour identifier les médicaments les plus vendus.
            </li>
            <li>
              Contrôlez les créances assurance restantes et suivez les règlements pour maîtriser votre trésorerie réelle.
            </li>
          </ol>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3 text-xs font-semibold text-slate-200">
              <ShieldAlert className="mb-2 h-4 w-4 text-rose-300" />
              Journal Sécurité SafeGuard
            </div>
            <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3 text-xs font-semibold text-slate-200">
              <FileText className="mb-2 h-4 w-4 text-emerald-300" />
              Bordereaux Assurance PDF
            </div>
            <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3 text-xs font-semibold text-slate-200">
              <BarChart3 className="mb-2 h-4 w-4 text-cyan-300" />
              Décisions Pilotées par Data
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900" title="Quick FAQ">FAQ Rapide</h3>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div>
            <p className="font-bold text-slate-900">Pourquoi une dépense est bloquée en attente ?</p>
            <p>
              Le workflow antifraude impose une validation admin avant sortie de caisse.
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Pourquoi le N° Carte assurance est-il obligatoire ?</p>
            <p>
              Sans N° Carte, la demande de remboursement peut être rejetée lors des contrôles 2026.
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Quand exporter le bordereau assurance ?</p>
            <p>
              À chaque fin de période de facturation ou dès qu'un lot de créances est prêt à transmission.
            </p>
          </div>
        </div>
        <a
          href={helpLink}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800"
          title="Assistance"
        >
          Assistance
        </a>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Glossaire BIZMAP</h3>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div>
            <p className="font-bold text-slate-900">Écart de Caisse</p>
            <p>Différence entre la caisse théorique calculée par le système et le comptage physique en fin de garde.</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Ticket Modérateur</p>
            <p>Montant payé par le patient dans une transaction assurance, après application du taux de prise en charge.</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Créance Douteuse</p>
            <p>Dette client non régularisée depuis plus de 30 jours et classée à risque pour le recouvrement.</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Séquençage Strict</p>
            <p>Pour éviter les fuites de capitaux, une seule personne peut être responsable du coffre à la fois. L&apos;administrateur garde le contrôle total pour débloquer le système en cas d&apos;oubli de clôture.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HelpCenter;
