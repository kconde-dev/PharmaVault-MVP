import { Cloud, LockKeyhole, ShieldCheck, Wallet } from 'lucide-react';

export function About() {
  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="PharmaVault Coffre-Fort Numérique">
          PharmaVault : Cloud-First ERP pour la Guinée.
        </h1>
        <p className="text-sm text-slate-700 leading-7 mt-3">
          PharmaVault applique une logique <span className="font-bold">Zero-Leak</span> pour verrouiller vos opérations.
          Chaque tablette, chaque boîte et chaque GNF est tracé de l&apos;entrée en stock jusqu&apos;à la transaction finale,
          sans angle mort dans le cycle officinal.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl shadow-slate-400/20">
        <div className="flex items-center gap-3 text-slate-100">
          <ShieldCheck className="h-6 w-6 text-emerald-300" />
          <h2 className="text-xl font-black">Logique Zero-Leak : Traçabilité Totale</h2>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-200">
          Avec PharmaVault, rien ne disparaît dans les zones grises. Les ventes, les sorties de stock,
          les corrections et les opérations de caisse sont horodatées, attribuées et auditables.
          Résultat: une gouvernance financière défendable, et une visibilité précise sur la rentabilité.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <Wallet className="h-5 w-5 text-emerald-300" />
            <p className="mt-2 text-sm font-bold text-white">Traçabilité des GNF</p>
            <p className="text-xs text-slate-300">Chaque flux monétaire est justifié, relié et consultable.</p>
          </article>
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <LockKeyhole className="h-5 w-5 text-cyan-300" />
            <p className="mt-2 text-sm font-bold text-white">Contrôles administrateur</p>
            <p className="text-xs text-slate-300">Aucune suppression ou altération sans validation admin.</p>
          </article>
          <article className="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
            <Cloud className="h-5 w-5 text-blue-300" />
            <p className="mt-2 text-sm font-bold text-white">Cloud sécurisé</p>
            <p className="text-xs text-slate-300">Données chiffrées, synchronisées et durables.</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Sécurité Zero-Leak & Sync Cloud Temps Réel</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          PharmaVault combine un contrôle Zero-Leak et une synchronisation Cloud en temps réel:
          chaque transaction, ajustement de stock et action utilisateur est instantanément horodaté et répliqué.
          Vous gardez une vision opérationnelle continue, avec un historique fiable pour l&apos;audit, la conformité
          et les décisions de gestion en officine, directement depuis votre smartphone.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Pourquoi les propriétaires choisissent PharmaVault</h3>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            En officine, une petite fuite quotidienne devient un grand manque à gagner mensuel. PharmaVault verrouille
            les opérations sensibles, relie chaque mouvement à un utilisateur et fournit des preuves exploitables en cas
            d&apos;écart de caisse, de stock ou de validation.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Cloud-Sync en temps réel, même en charge</h3>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Les données sont synchronisées en continu: ventes, dépenses, clôtures et statuts d&apos;approbation.
            Le manager suit son activité sans attendre la fin de journée, avec des rapports fiables pour
            les décisions urgentes et la planification.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Politique Zero-Leak: Retours clients tracés</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          PharmaVault applique une politique stricte de retour pour protéger la caisse: chaque retour validé
          enregistre le motif, met à jour la transaction d&apos;origine et crée une contre-écriture négative.
          Résultat: pas de fuite comptable, pas de "trou noir" dans les rapports, et une traçabilité complète
          pour l&apos;audit administrateur.
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-5">
        <p className="text-xs text-slate-500">Une solution propulsée par l&apos;écosystème BIZMAP.</p>
      </footer>
    </div>
  );
}

export default About;
