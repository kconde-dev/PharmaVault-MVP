import { BrainCircuit, AlertTriangle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type PredictionPoint = {
  product: string;
  daysRemaining: number;
  risk: 'critique' | 'surveille' | 'stable';
};

const PREDICTIONS: PredictionPoint[] = [
  { product: 'Paracetamol 500mg', daysRemaining: 4, risk: 'critique' },
  { product: 'Amoxicilline 1g', daysRemaining: 6, risk: 'critique' },
  { product: 'Insuline Rapide', daysRemaining: 8, risk: 'surveille' },
  { product: 'Vitamine C', daysRemaining: 11, risk: 'surveille' },
  { product: 'Omeprazole 20mg', daysRemaining: 15, risk: 'stable' },
  { product: 'Metformine 850mg', daysRemaining: 18, risk: 'stable' },
];

const chartData = PREDICTIONS.map((row) => ({
  ...row,
  productShort: row.product.length > 14 ? `${row.product.slice(0, 14)}...` : row.product,
}));

function riskLabel(risk: PredictionPoint['risk']): string {
  if (risk === 'critique') return 'Critique';
  if (risk === 'surveille') return 'A surveiller';
  return 'Stable';
}

export function Intelligence() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-8 bg-cyan-500 rounded-full" />
          <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-[0.2em]">AI Inventory Desk</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">Intelligence - Predictions de Rupture</h1>
        <p className="mt-2 text-sm leading-7 text-slate-700">
          Estimation IA des jours restants pour les produits sensibles, basee sur les tendances de sortie et la vitesse de rotation.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Top Produits a Risque</h2>
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-black uppercase tracking-widest text-amber-700">Analyse Predictive</span>
          </div>
        </div>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 6, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="productShort" tick={{ fill: '#475569', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                formatter={(value: number) => [`${value} jours`, 'Reste estime']}
                labelFormatter={(label) => `Produit: ${label}`}
              />
              <Bar dataKey="daysRemaining" fill="#06b6d4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-700">
          <BrainCircuit className="h-4 w-4 text-cyan-600" />
          Interpretation IA
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {PREDICTIONS.map((row) => (
            <article key={row.product} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-900">{row.product}</p>
              <p className="mt-1 text-xs text-slate-600">
                Estimation: <span className="font-black text-slate-800">{row.daysRemaining} jours</span> | Niveau: <span className="font-black text-slate-800">{riskLabel(row.risk)}</span>
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Intelligence;
