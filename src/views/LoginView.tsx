import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';

interface LoginViewProps {
  onForgotPassword: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onForgotPassword }) => {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Preencha seu e-mail e senha.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (!res.success) {
      setLocalError(res.error || 'Credenciais inválidas.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-amber-500 selection:text-white">
      {/* Background Ambience Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#171717] border border-neutral-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 space-y-8">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <BrandLogo size="lg" showSubtitle={false} />
          <div className="space-y-1">
            <h1 className="text-xl font-black tracking-tight text-white uppercase">
              Área Exclusiva de Membros
            </h1>
            <p className="text-xs text-neutral-400 font-medium">
              Estratégia • Disciplina • Consistência • Resultados
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {(localError || error) && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-300">
              E-mail de Acesso
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
                placeholder="seu.email@exemplo.com"
                className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A] border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-neutral-300">
                Senha
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-11 py-3 bg-[#0A0A0A] border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm uppercase tracking-wider py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <span>Validando Acesso...</span>
            ) : (
              <>
                <span>Acessar Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice Footer */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            Plataforma protegida com identificação individual e sessão única. Acessos simultâneos são bloqueados.
          </p>
        </div>
      </div>
    </div>
  );
};
