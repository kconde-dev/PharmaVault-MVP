import { ArrowRight, MapPinned, ShieldAlert, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

const solutions = [
  {
    title: 'Google Maps & SEO',
    subtitle: "L'Autoroute du Client",
    description:
      "Pourquoi rester invisible ? Si un client cherche 'Pharmacie ouverte' ou 'Quincaillerie Conakry', BIZMAP vous place en première position. Nous gérons vos avis clients, vos photos professionnelles et votre positionnement pour que votre commerce soit celui que l'on choisit.",
    to: '/dashboard/solutions/google-maps',
    icon: MapPinned,
    accent: 'text-cyan-300',
  },
  {
    title: 'Développement Sur-Mesure',
    subtitle: 'Votre Vision, Notre Code',
    description:
      "Chaque business est unique. Que vous ayez besoin d'une application de livraison, d'un système de gestion de paie ou d'un portail client, BIZMAP conçoit des solutions robustes, prêtes pour l'IA, adaptées aux réalités du marché africain.",
    to: '/dashboard/solutions/custom-apps',
    icon: Wrench,
    accent: 'text-amber-300',
  },
  {
    title: 'SafeGuard Security',
    subtitle: 'Zéro Démarque Inconnue',
    description:
      "Le vol à l'étalage n'est plus une fatalité. SafeGuard lie votre inventaire PharmaVault à des barrières physiques. Un produit sort sans être payé ? L'alarme retentit, une notification est envoyée. C'est la technologie au service de votre sérénité.",
    to: '/dashboard/solutions/safeguard',
    icon: ShieldAlert,
    accent: 'text-rose-300',
  },
];

export function OtherApps() {
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
        <h2 className="text-lg font-black text-slate-900">Marketplace BIZMAP</h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Les PME sont le cœur battant de l&apos;Afrique. Notre mission chez BIZMAP est de veiller à ce que la transition
          vers l&apos;IA et le digital profite à tous.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {solutions.map(({ title, subtitle, description, to, icon: Icon, accent }) => (
          <article
            key={title}
            className="rounded-3xl border border-slate-300 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-2xl shadow-slate-400/20 flex flex-col"
          >
            <div className="flex items-center gap-3">
              <Icon className={`h-6 w-6 ${accent}`} />
              <h3 className="text-lg font-black text-white">{title}</h3>
            </div>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-300">{subtitle}</p>
            <p className="mt-3 text-sm leading-7 text-slate-300 flex-1">{description}</p>
            <Link
              to={to}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 hover:bg-emerald-400"
              title={`Voir les détails - ${title}`}
            >
              Voir les détails
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm leading-7 text-slate-700">
          Le futur de l&apos;Afrique est digital, construisons-le ensemble.
        </p>
      </section>
    </div>
  );
}

export default OtherApps;
