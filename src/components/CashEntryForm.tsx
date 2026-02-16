import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PaymentMethod } from '@/lib/database.types';

export interface InsuranceOption {
  id: string;
  name: string;
}

export interface CashEntryFormValue {
  amount: string;
  method: PaymentMethod;
  isInsurancePayment: boolean;
  insuranceId: string;
  insuranceCardId: string;
  insurancePercentage: number;
}

interface CashEntryFormProps {
  value: CashEntryFormValue;
  onChange: (next: CashEntryFormValue) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  insurances: InsuranceOption[];
  insuranceLoadError: string | null;
  isOnline: boolean;
}

export function CashEntryForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  insurances,
  insuranceLoadError,
  isOnline,
}: CashEntryFormProps) {
  const totalAmount = Number(value.amount || 0);
  const insuranceRatio = value.isInsurancePayment ? value.insurancePercentage / 100 : 0;
  const insurancePart = totalAmount * insuranceRatio;
  const patientPart = totalAmount - insurancePart;

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Nouvelle Recette</h2>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">Montant Total (GNF) *</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Ex: 100000"
            value={value.amount}
            onChange={(e) => onChange({ ...value, amount: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Méthode de paiement *</label>
          <select
            value={value.method}
            onChange={(e) => onChange({ ...value, method: e.target.value as PaymentMethod })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="Espèces">Espèces</option>
            <option value="Orange Money (Code Marchand)">Orange Money (Code Marchand)</option>
          </select>
        </div>

        <div className="sm:col-span-2 rounded-lg border border-border bg-card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={value.isInsurancePayment}
              onChange={(e) =>
                onChange({
                  ...value,
                  isInsurancePayment: e.target.checked,
                  insuranceId: e.target.checked ? value.insuranceId : '',
                  insuranceCardId: e.target.checked ? value.insuranceCardId : '',
                  insurancePercentage: e.target.checked ? value.insurancePercentage : 80,
                })
              }
              className="h-4 w-4 rounded border-input"
            />
            Paiement Assurance
          </label>

          {value.isInsurancePayment && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-foreground">Nom de l&apos;assurance *</label>
                <select
                  value={value.insuranceId}
                  onChange={(e) => onChange({ ...value, insuranceId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Sélectionner une assurance</option>
                  {insurances.map((insurance) => (
                    <option key={insurance.id} value={insurance.id}>{insurance.name}</option>
                  ))}
                </select>
                {insuranceLoadError && (
                  <p className="mt-1 text-xs text-amber-700">
                    Impossible de charger la liste des assurances: {insuranceLoadError}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-600">
                  La part assurance est calculée automatiquement. Sélectionnez ici le mode de paiement pour le reste à charge du client.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">N° Carte / Matricule *</label>
                <Input
                  type="text"
                  placeholder="Ex: C-123456"
                  value={value.insuranceCardId}
                  onChange={(e) => onChange({ ...value, insuranceCardId: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">% de Prise en Charge</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={value.insurancePercentage}
                  onChange={(e) => onChange({ ...value, insurancePercentage: Number(e.target.value || 0) })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Répartition</label>
                <div className="mt-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <p className="text-emerald-700 font-semibold">
                    Part Assurance: {insurancePart.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} GNF
                  </p>
                  <p className="text-slate-700 font-semibold">
                    Part Patient: {patientPart.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} GNF
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <Button type="submit" disabled={!isOnline} className="w-full">
              Enregistrer Recette
            </Button>
            {!isOnline && (
              <p className="mt-2 text-xs text-amber-700">
                Connexion perdue. Enregistrement désactivé pour éviter la perte de données.
              </p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </section>
  );
}

export default CashEntryForm;
