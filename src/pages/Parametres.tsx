import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Save,
  RefreshCcw,
  Globe,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Database,
  Smartphone,
  Server,
  Fingerprint
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { getSettings, saveSettings, AppSettings } from '@/lib/settings';
import { checkSupabaseConnection } from '@/lib/heartbeat';

export function Parametres() {
  const { role } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [newPin, setNewPin] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';

  useEffect(() => {
    const checkStatus = async () => {
      const isOnline = await checkSupabaseConnection();
      setServerStatus(isOnline ? 'online' : 'offline');
    };
    checkStatus();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    saveSettings(settings);
    setIsSaving(false);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3000);
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (!/^\d{6}$/.test(newPin)) {
      setPinError('Le code d\'accès doit comporter 6 chiffres.');
      return;
    }

    setIsUpdatingPin(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPin });
      if (error) throw error;
      setPinSuccess(true);
      setNewPin('');
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Défaut de mise à jour.');
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-8 bg-slate-900 rounded-full" />
            <span className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em]">Configuration & Infrastructure</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Paramètres Système
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Orchestration de l'officine et paramètres de liaison data.
          </p>
        </div>

        {serverStatus === 'online' ? (
          <div className="flex items-center gap-3 bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-100 shadow-sm animate-in scale-in duration-500">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Serveur Opérationnel</span>
          </div>
        ) : serverStatus === 'offline' ? (
          <div className="flex items-center gap-3 bg-rose-50 px-5 py-2.5 rounded-2xl border border-rose-100 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-bounce" />
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Serveur Déconnecté</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
            <RefreshCcw className="h-3 w-3 animate-spin text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En cours...</span>
          </div>
        )}
      </header>

      {!isAdmin && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-4 text-amber-600 animate-in slide-in-from-top-4">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-xs font-bold uppercase tracking-widest">Mode Lecture Seule: Privilèges Administrateur Requis pour modification.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Pharmacy Profile */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="h-5 w-1 bg-emerald-500 rounded-full" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em]">Profil de l'Officine</h2>
          </div>

          <div className="glass-card rounded-[2.5rem] p-8 border border-white/60 shadow-xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Globe className="h-3 w-3" /> Nom Commercial
              </label>
              <Input
                value={settings.pharmacy.name}
                className="h-12 bg-slate-100/50 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white transition-all shadow-inner"
                onChange={e => setSettings({
                  ...settings,
                  pharmacy: { ...settings.pharmacy, name: e.target.value }
                })}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Adresse Géographique
              </label>
              <Input
                value={settings.pharmacy.address}
                className="h-12 bg-slate-100/50 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white transition-all shadow-inner"
                onChange={e => setSettings({
                  ...settings,
                  pharmacy: { ...settings.pharmacy, address: e.target.value }
                })}
                disabled={!isAdmin}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Phone className="h-3 w-3" /> Ligne Directe
                </label>
                <Input
                  value={settings.pharmacy.phone}
                  className="h-12 bg-slate-100/50 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white transition-all shadow-inner"
                  onChange={e => setSettings({
                    ...settings,
                    pharmacy: { ...settings.pharmacy, phone: e.target.value }
                  })}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Mail className="h-3 w-3" /> E-mail Contact
                </label>
                <Input
                  value={settings.pharmacy.email}
                  className="h-12 bg-slate-100/50 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white transition-all shadow-inner"
                  onChange={e => setSettings({
                    ...settings,
                    pharmacy: { ...settings.pharmacy, email: e.target.value }
                  })}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>

          <section className="space-y-6 pt-4">
            <div className="flex items-center gap-3 px-2">
              <div className="h-5 w-1 bg-amber-500 rounded-full" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em]">Sécurisation Personnelle</h2>
            </div>
            <div className="glass-card rounded-[2.5rem] p-8 border border-white/60 shadow-xl space-y-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Renouvellement du Code de Session</p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    type="password"
                    placeholder="••••••"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="h-12 bg-slate-100/50 border-slate-200 rounded-xl px-4 text-sm font-black tracking-[0.8em]"
                  />
                  <Fingerprint className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                </div>
                <Button
                  type="button"
                  onClick={handleUpdatePin}
                  isLoading={isUpdatingPin}
                  disabled={newPin.length !== 6}
                  className="h-12 px-6 rounded-xl pharmacy-gradient text-white font-black text-[10px] uppercase tracking-widest border-0 shadow-lg shadow-emerald-500/20"
                >
                  Mettre à jour
                </Button>
              </div>
              {pinSuccess && <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">✓ Code d'accès mis à jour</p>}
              {pinError && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">⚠️ {pinError}</p>}
            </div>
          </section>
        </section>

        {/* System & Notifications */}
        <div className="space-y-10">
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="h-5 w-1 bg-green-500 rounded-full" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em]">Liaison WhatsApp (API)</h2>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-white/60 shadow-xl space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Protocoles de Rapportage</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Envoi automatique lors de la clôture.</p>
                </div>
                <button
                  type="button"
                  onClick={() => isAdmin && setSettings({
                    ...settings,
                    whatsapp: { ...settings.whatsapp, enabled: !settings.whatsapp.enabled }
                  })}
                  disabled={!isAdmin}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${settings.whatsapp.enabled ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${settings.whatsapp.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Smartphone className="h-3 w-3" /> Terminal de Réception
                </label>
                <div className="relative">
                  <Input
                    value={settings.whatsapp.recipientNumber}
                    placeholder="+224XXXXXXXXX"
                    className="h-12 bg-slate-100/50 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:bg-white transition-all shadow-inner"
                    onChange={e => setSettings({
                      ...settings,
                      whatsapp: { ...settings.whatsapp, recipientNumber: e.target.value }
                    })}
                    disabled={!isAdmin || !settings.whatsapp.enabled}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 grayscale opacity-50">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-[8px] font-black text-slate-500">ENCRYPTED</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="h-5 w-1 bg-indigo-500 rounded-full" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em]">Ressources Système</h2>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-white/60 shadow-xl space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                    <Server className="h-8 w-8 text-slate-900" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Architecture</p>
                  <p className="text-xs font-black text-slate-900 italic">PHARMAVAULT V1.0</p>
                  <p className="text-[9px] font-bold text-emerald-500 mt-1">PRODUCTION STABLE</p>
                </div>
                <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                    <Database className="h-8 w-8 text-slate-900" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stockage Cloud</p>
                  <p className="text-xs font-black text-slate-900 italic">SUPABASE DB</p>
                  <p className="text-[9px] font-bold text-indigo-500 mt-1">SYNCHRONISÉ</p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all gap-3"
                onClick={async () => {
                  setServerStatus('checking');
                  const ok = await checkSupabaseConnection();
                  setServerStatus(ok ? 'online' : 'offline');
                }}
              >
                <RefreshCcw className="h-3 w-3" />
                Analyser la Latence Réseau
              </Button>
            </div>
          </section>
        </div>

        {isAdmin && (
          <div className="lg:col-span-2 flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                Modifications appliquées en temps réel <br /> sur tous les terminaux de l'officine.
              </p>
            </div>

            <div className="flex items-center gap-6">
              {isSuccess && (
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-in slide-in-from-right-4">
                  ✓ Registres sauvegardés
                </p>
              )}
              <Button
                type="submit"
                isLoading={isSaving}
                className="h-16 px-10 rounded-2xl pharmacy-gradient text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-emerald-500/30 group border-0"
              >
                <Save className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                Mettre à jour l'Infrastructure
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default Parametres;

