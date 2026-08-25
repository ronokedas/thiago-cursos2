import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Clock, Bell, Save, CheckCircle2, Globe } from 'lucide-react';
import { SystemSettings } from '../types';

export const AdminSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Configurações Gerais da Plataforma
        </h1>
        <p className="text-xs text-neutral-400">
          Personalize parâmetros de liberação progressiva (7 dias), segurança de vídeo e avisos aos alunos.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Configurações salvas e aplicadas com sucesso em todo o sistema!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. General Info */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            Identidade da Plataforma
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">Nome da Plataforma</label>
              <input
                type="text"
                value={settings.platformName}
                onChange={e => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">E-mail de Suporte / Contato</label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={e => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Business Logic: 7-Day & Validity Parameters */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Regras de Liberação Progressiva & Conclusão
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">
                Dias para Liberação Automática (Padrão)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.progressiveReleaseDays}
                onChange={e => setSettings({ ...settings, progressiveReleaseDays: parseInt(e.target.value) || 7 })}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500 font-bold text-amber-400"
              />
              <p className="text-[10px] text-neutral-500">
                Garante proteção contra reembolsos nos primeiros 7 dias.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">
                Duração Padrão do Acesso (Meses)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.defaultAccessDurationMonths}
                onChange={e => setSettings({ ...settings, defaultAccessDurationMonths: parseInt(e.target.value) || 12 })}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-neutral-500">Padrão aplicado no cadastro de alunos (12 meses).</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-300">
                Percentual para Conclusão da Aula (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                value={settings.completionThresholdPercent}
                onChange={e => setSettings({ ...settings, completionThresholdPercent: parseInt(e.target.value) || 90 })}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-neutral-500">Mínimo assistido para marcar aula como concluída.</p>
            </div>
          </div>
        </div>

        {/* 3. Security & Anti-Leak Watermark */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Proteção Anti-Vazamento e Marca D'Água
          </h2>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-neutral-200 font-semibold">
              <input
                type="checkbox"
                checked={settings.watermarkEnabled}
                onChange={e => setSettings({ ...settings, watermarkEnabled: e.target.checked })}
                className="rounded accent-amber-500"
              />
              <span>Ativar Marca D'Água Dinâmica Flutuante sobre o Player</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-300">Intervalo de Movimento (Segundos)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={settings.watermarkIntervalSeconds}
                  onChange={e => setSettings({ ...settings, watermarkIntervalSeconds: parseInt(e.target.value) || 15 })}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-300">Máximo de Sessões Simultâneas</label>
                <input
                  type="number"
                  disabled
                  value={1}
                  className="w-full px-3.5 py-2.5 bg-neutral-950/50 border border-neutral-800 rounded-xl text-neutral-500 cursor-not-allowed"
                />
                <p className="text-[10px] text-amber-500">Fixado em 1 (Sessão Única Obrigatória).</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Notice Banner */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Aviso Geral no Topo do Dashboard dos Alunos
          </h2>

          <div className="space-y-1.5 text-xs">
            <label className="font-semibold text-neutral-300">Texto do Banner de Avisos (Opcional)</label>
            <input
              type="text"
              value={settings.noticeBanner || ''}
              onChange={e => setSettings({ ...settings, noticeBanner: e.target.value })}
              placeholder="Ex: Sala ao vivo de fechamento de mercado hoje às 17h00!"
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando Configurações...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
