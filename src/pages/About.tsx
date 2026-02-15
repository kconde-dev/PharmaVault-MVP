import {
  Activity,
  Cloud,
  Eye,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export function About() {
  const contactLink = buildWhatsAppLink(
    "Bonjour, je souhaite contacter l'équipe PharmaVault pour des informations commerciales et techniques.",
  );

  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="About PharmaVault">
          PharmaVault 2026 : Excellence en Gestion Officinale.
        </h1>
        <p className="text-sm text-slate-500" title="Vision and cloud architecture">
          Une vision de contrôle total, en temps réel, pour les officines qui veulent performer sans perdre
          un seul GNF.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-300/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3 text-slate-200">
          <Cloud className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg font-black uppercase tracking-wider" title="Remote Monitoring Architecture">
            Architecture de Monitoring à Distance
          </h2>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-200">
          PharmaVault n'est pas qu'un outil de caisse, c'est l'épine dorsale de votre officine.
          Conçu pour le contexte exigeant de 2026, il offre une visibilité à 360° sur vos finances.
          Que vous soyez à Conakry ou à l'étranger, gardez le contrôle total sur chaque recette et
          chaque dépense en temps réel.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Chaque transaction est chiffrée, horodatée et synchronisée vers le cloud.
          Les propriétaires peuvent superviser l'activité depuis n'importe quel smartphone,
          partout dans le monde, avec une continuité opérationnelle instantanée.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400" title="Capture Layer">Niveau 1</p>
            <p className="mt-1 text-xs font-bold text-slate-100">Capture transactionnelle</p>
          </div>
          <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400" title="Security Layer">Niveau 2</p>
            <p className="mt-1 text-xs font-bold text-slate-100">Chiffrement + contrôle d'accès</p>
          </div>
          <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400" title="Cloud Sync Layer">Niveau 3</p>
            <p className="mt-1 text-xs font-bold text-slate-100">Synchronisation cloud en direct</p>
          </div>
          <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400" title="Decision Layer">Niveau 4</p>
            <p className="mt-1 text-xs font-bold text-slate-100">Pilotage analytique mobile</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-slate-500 bg-slate-800/80 px-3 py-1 text-xs font-bold text-slate-200"
            title="Encrypted sync"
          >
            <LockKeyhole className="h-3.5 w-3.5 text-emerald-300" />
            Chiffrement de bout en bout
          </span>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-slate-500 bg-slate-800/80 px-3 py-1 text-xs font-bold text-slate-200"
            title="Global mobile access"
          >
            <Smartphone className="h-3.5 w-3.5 text-cyan-300" />
            Supervision mobile mondiale
          </span>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-sm">
          <Eye className="h-6 w-6 text-slate-700" />
          <h2 className="mt-3 text-lg font-black text-slate-900" title="Total Transparency">
            Transparence Totale
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Every GNF is tracked from the shelf to the vault.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Chaque mouvement est attribué à un utilisateur, une date et un contexte.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-sm">
          <LockKeyhole className="h-6 w-6 text-rose-500" />
          <h2 className="mt-3 text-lg font-black text-slate-900" title="Zero Fraud">
            Zéro Fraude
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Les workflows d'approbation des dépenses garantissent qu'aucun GNF ne sort du tiroir
            sans consentement administrateur.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Résultat: moins d'écarts de caisse, plus de confiance, audit simplifié.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-sm">
          <Wrench className="h-6 w-6 text-blue-700" />
          <h2 className="mt-3 text-lg font-black text-slate-900" title="Customizable Platform">
            Sur-Mesure
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Le système est modulaire et peut être personnalisé à la demande avec des rapports SQL
            spécifiques, des logiques fiscales localisées et des extensions métier.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            PharmaVault s'adapte à vos procédures au lieu d'imposer un modèle rigide.
          </p>
        </article>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-black text-slate-900" title="Security Commitment">Engagement Sécurité</h3>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Les données sensibles sont gérées avec une politique de sécurité stricte: accès par rôle,
            journalisation des actions critiques, et séparation claire entre saisie staff et validation admin.
            Votre gouvernance financière devient défendable devant un cabinet d'audit.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-700" />
            <h3 className="text-lg font-black text-slate-900" title="Operational Impact">Impact Opérationnel</h3>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            En pratique, PharmaVault réduit le temps de consolidation quotidienne, diminue les erreurs de saisie,
            et accélère la prise de décision. Les responsables ne découvrent plus les problèmes en fin de mois:
            ils les traitent au moment où ils apparaissent.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-black text-white" title="Global Supervision">
              Supervisez votre officine depuis n'importe où
            </h3>
            <p className="text-sm text-slate-200">
              Contrôle mobile global, données en direct, vision financière consolidée.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-200">
            <Globe2 className="h-4 w-4 text-cyan-300" />
            Ready for Enterprise Rollout
          </div>
          <a
            href={contactLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
            title="Contact"
          >
            Contact
          </a>
        </div>
      </section>
    </div>
  );
}

export default About;
