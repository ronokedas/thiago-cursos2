import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';

export const FirstAccessView: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = calculateStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('A nova senha deve possuir no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const res = await changePassword(newPassword);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || 'Erro ao alterar senha.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <BrandLogo size="md" showSubtitle={false} />
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Primeiro Acesso — Crie Sua Senha</h2>
            <p className="text-xs text-neutral-400">
              Olá, <strong className="text-amber-400">{user?.name}</strong>. Por segurança, defina sua senha pessoal definitiva para continuar.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-300">Nova Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres (letras, números e símbolos)"
                className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            <div className="flex gap-1.5 pt-1.5">
              {[1, 2, 3, 4].map(idx => (
                <div
                  key={idx}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    strength >= idx
                      ? strength === 1
                        ? 'bg-rose-500'
                        : strength === 2
                        ? 'bg-amber-500'
                        : strength === 3
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                      : 'bg-neutral-800'
                  }`}
                />
              ))}
            </div>
            <p className="text-[10px] text-neutral-400">
              {strength <= 1 && 'Senha fraca'}
              {strength === 2 && 'Senha média'}
              {strength === 3 && 'Senha boa'}
              {strength === 4 && 'Senha muito forte (Excelente!)'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-300">Confirmar Nova Senha</label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Digite a mesma senha novamente"
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-3 rounded-xl transition-all uppercase tracking-wider text-xs cursor-pointer shadow-lg shadow-amber-900/30"
          >
            {submitting ? 'Salvando Senha...' : 'Salvar e Acessar Minhas Aulas'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center">
          <button
            onClick={() => logout()}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Sair e entrar mais tarde
          </button>
        </div>
      </div>
    </div>
  );
};
