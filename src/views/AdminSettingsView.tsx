import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Clock, Bell, Save, CheckCircle2, Globe, Users, UserPlus, KeyRound, Send, AlertCircle, Trash2, LockKeyhole } from 'lucide-react';
import { SystemSettings } from '../types';
import { useAuth } from '../context/AuthContext';

export const AdminSettingsView: React.FC = () => {
  const { user, refreshAuth, changePassword } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', phone: '', password: '', autoGeneratePassword: true });
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdAdminPassword, setCreatedAdminPassword] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user) setProfileForm({ name: user.name, email: user.email });
  }, [user?.id, user?.name, user?.email]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const fetchAdmins = async () => {
    if (user?.role !== 'SUPER_ADMIN') return;
    const res = await fetch('/api/admin/admins');
    if (res.ok) setAdmins((await res.json()).admins || []);
  };

  useEffect(() => { void fetchAdmins(); }, [user?.role]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: (() => { const { smtpPassword, ...safeSettings } = settings; return JSON.stringify({ ...safeSettings, smtp: { ...settings.smtp, password: smtpPassword || '' } }); })(),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings({ ...data.settings, smtpPassword: '' });
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async () => {
    setAdminSaving(true); setAdminMessage(null); setCreatedAdminPassword(null);
    try {
      const res = await fetch('/api/admin/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adminForm) });
      const data = await res.json();
      if (!res.ok) { setAdminMessage({ type: 'error', text: data.error || 'Não foi possível criar o administrador.' }); return; }
      setCreatedAdminPassword(data.temporaryPassword);
      setAdminMessage({ type: 'success', text: 'Administrador criado. Copie a senha inicial agora.' });
      setAdminForm({ name: '', email: '', phone: '', password: '', autoGeneratePassword: true });
      void fetchAdmins();
    } catch { setAdminMessage({ type: 'error', text: 'Erro de conexão ao criar administrador.' }); }
    finally { setAdminSaving(false); }
  };

  const handleAdminStatus = async (admin: any) => {
    const nextStatus = admin.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    const res = await fetch(`/api/admin/admins/${admin.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
    const data = await res.json();
    setAdminMessage({ type: res.ok ? 'success' : 'error', text: data.message || data.error || 'Não foi possível atualizar o administrador.' });
    if (res.ok) void fetchAdmins();
  };

  const handleAdminReset = async (admin: any) => {
    const res = await fetch(`/api/admin/admins/${admin.id}/reset-password`, { method: 'POST' });
    const data = await res.json();
    setAdminMessage({ type: res.ok ? 'success' : 'error', text: res.ok ? `Nova senha de ${admin.name}: ${data.temporaryPassword}` : (data.error || 'Não foi possível redefinir a senha.') });
  };

  const handleAdminDelete = async (admin: any) => {
    if (!window.confirm(`Excluir definitivamente o administrador ${admin.name}?`)) return;
    const res = await fetch(`/api/admin/admins/${admin.id}`, { method: 'DELETE' });
    const data = await res.json();
    setAdminMessage({ type: res.ok ? 'success' : 'error', text: data.message || data.error || 'Não foi possível excluir o administrador.' });
    if (res.ok) void fetchAdmins();
  };

  const handleProfileSave = async () => {
    setProfileSaving(true); setProfileMessage(null);
    try {
      const res = await fetch('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) });
      const data = await res.json();
      setProfileMessage({ type: res.ok ? 'success' : 'error', text: data.message || data.error || 'Não foi possível atualizar o perfil.' });
      if (res.ok) await refreshAuth();
    } catch { setProfileMessage({ type: 'error', text: 'Erro de conexão ao atualizar o perfil.' }); }
    finally { setProfileSaving(false); }
  };

  const handlePasswordSave = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmation) { setProfileMessage({ type: 'error', text: 'A confirmação da nova senha não confere.' }); return; }
    setPasswordSaving(true); setProfileMessage(null);
    const result = await changePassword(passwordForm.newPassword, passwordForm.currentPassword || undefined);
    setProfileMessage({ type: result.success ? 'success' : 'error', text: result.success ? 'Senha alterada com sucesso.' : (result.error || 'Não foi possível alterar a senha.') });
    if (result.success) setPasswordForm({ currentPassword: '', newPassword: '', confirmation: '' });
    setPasswordSaving(false);
  };

  const handleSmtpTest = async () => {
    if (!settings) return;
    setSaving(true); setSavedSuccess(false);
    try {
      const res = await fetch('/api/admin/settings/smtp/test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setAdminMessage({ type: 'error', text: data.error || 'Falha no teste SMTP.' }); return; }
      setAdminMessage({ type: 'success', text: data.message });
      setSettings({ ...settings, smtp: { ...settings.smtp, lastTestAt: data.lastTestAt, lastTestStatus: 'SUCCESS' } });
    } catch { setAdminMessage({ type: 'error', text: 'Erro de conexão ao testar SMTP.' }); }
    finally { setSaving(false); }
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

      {adminMessage && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${adminMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'}`}>
          {adminMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{adminMessage.text}</span>
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
                value={settings.defaultAccessMonths}
                onChange={e => setSettings({ ...settings, defaultAccessMonths: parseInt(e.target.value) || 12 })}
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
        {settings.smtp && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Send className="w-4 h-4 text-amber-400" /> Configuração de E-mail SMTP</h2>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${settings.smtp.passwordConfigured ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-neutral-400 bg-neutral-800 border-neutral-700'}`}>
                {settings.smtp.passwordConfigured ? 'SMTP CONFIGURADO' : 'SMTP NÃO CONFIGURADO'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <input value={settings.smtp.host} onChange={e => setSettings({ ...settings, smtp: { ...settings.smtp, host: e.target.value } })} placeholder="Servidor SMTP" className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input type="number" value={settings.smtp.port} onChange={e => setSettings({ ...settings, smtp: { ...settings.smtp, port: parseInt(e.target.value) || 587 } })} placeholder="Porta" className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input value={settings.smtp.username} onChange={e => setSettings({ ...settings, smtp: { ...settings.smtp, username: e.target.value } })} placeholder="Usuário SMTP" className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input type="password" value={settings.smtpPassword || ''} onChange={e => setSettings({ ...settings, smtpPassword: e.target.value })} placeholder={settings.smtp.passwordConfigured ? 'Senha atual preservada (digite para trocar)' : 'Senha SMTP'} className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input value={settings.smtp.from} onChange={e => setSettings({ ...settings, smtp: { ...settings.smtp, from: e.target.value } })} placeholder="Remetente" className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 sm:col-span-2" />
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-300"><input type="checkbox" checked={settings.smtp.secure} onChange={e => setSettings({ ...settings, smtp: { ...settings.smtp, secure: e.target.checked } })} className="rounded accent-amber-500" /> Usar conexão segura (SSL/TLS, normalmente porta 465)</label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleSmtpTest} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold"><Send className="w-3.5 h-3.5" /> Testar SMTP</button>
              {settings.smtp.lastTestAt && <span className={`text-[10px] ${settings.smtp.lastTestStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>Último teste: {new Date(settings.smtp.lastTestAt).toLocaleString('pt-BR')}</span>}
            </div>
            <p className="text-[10px] text-neutral-500">O teste envia uma mensagem para o e-mail de suporte configurado acima. A senha nunca é exibida nem devolvida pela API.</p>
          </div>
        )}

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

        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><LockKeyhole className="w-4 h-4 text-amber-400" /> Minha conta</h2>
          {profileMessage && <div className={`p-3 rounded-xl text-xs font-semibold ${profileMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'}`}>{profileMessage.text}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Nome" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
            <input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} placeholder="E-mail" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
          </div>
          <button type="button" onClick={() => void handleProfileSave()} disabled={profileSaving} className="px-4 py-2.5 bg-neutral-800 text-amber-300 rounded-xl text-xs font-semibold">{profileSaving ? 'Salvando...' : 'Salvar nome e e-mail'}</button>
          <div className="border-t border-neutral-800 pt-5 space-y-3">
            <p className="text-xs font-semibold text-neutral-300">Alterar minha senha</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder="Senha atual" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input type="password" minLength={8} value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="Nova senha (mín. 8)" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input type="password" value={passwordForm.confirmation} onChange={e => setPasswordForm({ ...passwordForm, confirmation: e.target.value })} placeholder="Confirmar nova senha" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
            </div>
            <button type="button" onClick={() => void handlePasswordSave()} disabled={passwordSaving} className="px-4 py-2.5 bg-amber-500 text-neutral-950 rounded-xl text-xs font-bold">{passwordSaving ? 'Alterando...' : 'Alterar senha'}</button>
          </div>
        </div>

        {user?.role === 'SUPER_ADMIN' && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" /> Administradores do Sistema</h2>
            <div className="space-y-2">
              {admins.map(admin => (
                <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
                  <div><p className="font-semibold text-white">{admin.name} {admin.role === 'SUPER_ADMIN' && <span className="text-amber-400">(Super)</span>}</p><p className="text-neutral-500">{admin.email}</p></div>
                  <div className="flex items-center gap-2"><span className={admin.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}>{admin.status === 'ACTIVE' ? 'Ativo' : 'Bloqueado'}</span>{admin.role !== 'SUPER_ADMIN' && <><button type="button" onClick={() => void handleAdminStatus(admin)} className="px-2 py-1 rounded-lg bg-neutral-800 text-neutral-300">{admin.status === 'ACTIVE' ? 'Bloquear' : 'Ativar'}</button><button type="button" onClick={() => void handleAdminReset(admin)} className="p-1.5 rounded-lg bg-neutral-800 text-amber-300" title="Redefinir senha"><KeyRound className="w-3.5 h-3.5" /></button><button type="button" onClick={() => void handleAdminDelete(admin)} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20" title="Excluir administrador"><Trash2 className="w-3.5 h-3.5" /></button></>}</div>
                </div>
              ))}
            </div>
            {adminMessage && <div className={`p-3 rounded-xl text-xs font-semibold ${adminMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'}`}>{adminMessage.text}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-neutral-800 pt-5">
              <input required value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} placeholder="Nome do administrador" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input required type="email" value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="E-mail" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <input value={adminForm.phone} onChange={e => setAdminForm({ ...adminForm, phone: e.target.value })} placeholder="Telefone (opcional)" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              {!adminForm.autoGeneratePassword && <input required minLength={8} type="password" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="Senha inicial" className="px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />}
              <label className="flex items-center gap-2 text-neutral-300"><input type="checkbox" checked={adminForm.autoGeneratePassword} onChange={e => setAdminForm({ ...adminForm, autoGeneratePassword: e.target.checked })} className="rounded accent-amber-500" /> Gerar senha automaticamente</label>
              <button disabled={adminSaving} type="button" onClick={() => void handleCreateAdmin()} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-neutral-950 rounded-xl font-bold uppercase"><UserPlus className="w-3.5 h-3.5" /> {adminSaving ? 'Criando...' : 'Cadastrar administrador'}</button>
              {createdAdminPassword && <p className="sm:col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">Senha inicial: <strong className="font-mono">{createdAdminPassword}</strong> — copie agora; ela não será exibida novamente.</p>}
            </div>
          </div>
        )}

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
