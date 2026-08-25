import React, { useState } from 'react';
import { 
  User as UserIcon, Lock, ShieldCheck, Calendar, 
  Smartphone, Globe, CheckCircle2, AlertCircle, Sparkles, KeyRound 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const StudentProfileView: React.FC = () => {
  const { user, session, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 8 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'A confirmação de senha não corresponde.' });
      return;
    }

    setSubmitting(true);
    const res = await changePassword(newPassword, currentPassword);
    setSubmitting(false);

    if (res.success) {
      setFeedback({ type: 'success', message: 'Senha atualizada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setFeedback({ type: 'error', message: res.error || 'Erro ao alterar senha.' });
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Meu Perfil & Segurança</h1>
        <p className="text-xs text-neutral-400">
          Gerencie seus dados de acesso, visualize os detalhes da sua sessão ativa e proteja sua conta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Card: Student Info & Active Session */}
        <div className="space-y-6">
          {/* Personal Info Box */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-amber-400" />
              Dados do Aluno
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-neutral-800/80">
                <span className="text-neutral-400">Nome Completo:</span>
                <span className="text-neutral-100 font-semibold">{user?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-800/80">
                <span className="text-neutral-400">E-mail Cadastrado:</span>
                <span className="text-neutral-100 font-semibold">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-800/80">
                <span className="text-neutral-400">Início da Matrícula:</span>
                <span className="text-neutral-100 font-semibold">{formatDate(user?.startDate)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-neutral-400">Expiração do Acesso:</span>
                <span className="text-amber-400 font-bold">{formatDate(user?.expirationDate)}</span>
              </div>
            </div>
          </div>

          {/* Session Security Details */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Sessão Ativa Conectada
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-neutral-950/80 rounded-2xl border border-neutral-800">
                <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
                <div>
                  <p className="text-neutral-200 font-medium">Endereço IP</p>
                  <p className="text-[11px] font-mono text-neutral-400">{session?.ipAddress || '127.0.0.1'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-950/80 rounded-2xl border border-neutral-800">
                <Smartphone className="w-4 h-4 text-neutral-400 shrink-0" />
                <div>
                  <p className="text-neutral-200 font-medium">Dispositivo & Navegador</p>
                  <p className="text-[11px] text-neutral-400 truncate max-w-[280px]">
                    {session?.device || 'Navegador Web'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-[11px] text-amber-300">
                Política de segurança de sessão única ativa: novos logins em outro navegador encerram esta conexão imediatamente.
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Change Password */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Alterar Senha de Acesso
          </h2>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-300">Senha Atual</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-300">Nova Senha</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-300">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-900/30 cursor-pointer"
            >
              {submitting ? 'Atualizando...' : 'Salvar Nova Senha'}
            </button>
          </form>

          <div className="pt-4 border-t border-neutral-800 text-[11px] text-neutral-500 leading-relaxed">
            Seus dados são protegidos em conformidade com as diretrizes da LGPD. Nenhum dado é compartilhado com terceiros.
          </div>
        </div>
      </div>
    </div>
  );
};
