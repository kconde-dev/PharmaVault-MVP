import { Cloud, LockKeyhole, ShieldCheck, Wallet } from 'lucide-react';

export function About() {
  return (
    <div className="p-6 lg:p-8 space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="PharmaVault Coffre-Fort Numérique">
          PharmaVault : Votre Coffre-Fort Numérique.
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
        <h3 className="text-lg font-black text-slate-900">Sécurité et Intégrité des Données</h3>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Toutes les données PharmaVault sont chiffrées puis synchronisées dans le Cloud.
          Ce modèle garantit qu&apos;une donnée ne peut pas être supprimée ni modifiée hors des règles de gouvernance
          applicative. Toute action sensible suit un contrôle administrateur, pour empêcher les manipulations
          non autorisées et préserver l&apos;historique métier.
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-5">
        <p className="text-xs text-slate-500">Une solution propulsée par l&apos;écosystème BIZMAP.</p>
      </footer>
    </div>
  );
}

export default About;
