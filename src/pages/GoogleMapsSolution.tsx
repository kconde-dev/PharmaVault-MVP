import { MapPin, Star, TrendingUp, Users } from 'lucide-react';

export function GoogleMapsSolution() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="Google Maps et SEO local">
          Visibilité Google Maps (Détails)
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          À Conakry, si vous n&apos;êtes pas sur la carte, vous n&apos;existez pas.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-emerald-600" />
          <h2 className="text-xl font-black text-slate-900">Top 3 Google 3-Pack</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          BIZMAP ne se contente pas de vous lister ; nous optimisons votre fiche pour que vous apparaissiez
          dans le Google 3-Pack (les 3 premiers résultats). Plus d&apos;appels, plus d&apos;itinéraires, plus de ventes.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Sur des profils correctement optimisés, l&apos;augmentation de trafic local peut atteindre 40%:
          davantage de visites en officine, de demandes urgentes et de clients réguliers.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <MapPin className="h-5 w-5 text-cyan-700" />
            <p className="mt-2 text-sm font-bold text-slate-900">Position locale</p>
            <p className="text-xs text-slate-600">Optimisation pour vos zones de chalandise prioritaires.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Star className="h-5 w-5 text-amber-500" />
            <p className="mt-2 text-sm font-bold text-slate-900">Gestion des avis</p>
            <p className="text-xs text-slate-600">Plus de crédibilité, plus de clics, plus de visites.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Users className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-sm font-bold text-slate-900">Trafic en magasin</p>
            <p className="text-xs text-slate-600">Objectif concret: davantage de clients physiques chaque semaine.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default GoogleMapsSolution;
