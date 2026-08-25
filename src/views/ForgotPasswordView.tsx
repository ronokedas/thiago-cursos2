import React, { useState } from 'react';
import { Mail, ArrowLeft, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onBackToLogin }) => {
  const resetToken = new URLSearchParams(window.location.search).get('resetToken');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8 || newPassword !== confirmPassword) { setError('As senhas devem ser iguais e ter pelo menos 8 caracteres.'); return; }
    const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, newPassword }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Não foi possível redefinir a senha.'); return; }
    setResetDone(true);
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <BrandLogo size="md" showSubtitle={false} />
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">
            Recuperação de Senha
          </h2>
          <p className="text-xs text-neutral-400">
            Informe o e-mail cadastrado na plataforma para receber as instruções de redefinição de acesso.
          </p>
        </div>

        {resetToken ? (
          resetDone ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl space-y-3 text-center"><CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" /><p className="text-xs text-neutral-200">Senha redefinida com sucesso.</p><button onClick={onBackToLogin} className="w-full py-2.5 bg-amber-500 text-neutral-950 text-xs font-bold rounded-xl">Voltar ao Login</button></div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{error}</p>}
              <input required minLength={8} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova senha (mínimo 8 caracteres)" className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100" />
              <input required minLength={8} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirme a nova senha" className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100" />
              <button type="submit" className="w-full py-3 bg-amber-500 text-neutral-950 font-bold rounded-xl uppercase text-xs">Redefinir Senha</button>
            </form>
          )
        ) : submitted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-xs text-neutral-200 font-medium leading-relaxed">
              Se o e-mail informado estiver ativo, enviamos o link de redefinição com validade de 60 minutos. Verifique sua caixa de entrada e spam.
            </p>
            <button
              onClick={onBackToLogin}
              className="mt-2 w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 rounded-xl transition-colors cursor-pointer"
            >
              Voltar para o Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-300">
                Seu E-mail Cadastrado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="aluno@exemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 rounded-xl transition-all uppercase tracking-wider text-xs cursor-pointer shadow-lg shadow-amber-900/30"
            >
              {submitting ? 'Enviando Link...' : 'Enviar Link de Redefinição'}
              <Send className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
