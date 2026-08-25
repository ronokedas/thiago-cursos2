import React, { useState } from 'react';
import { 
   BookOpen, User as UserIcon, LogOut, ShieldCheck, 
   Menu, X, Sparkles, Home, HelpCircle, AlertTriangle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';

interface StudentNavbarProps {
  currentTab: 'dashboard' | 'course' | 'profile';
  onNavigate: (tab: 'dashboard' | 'course' | 'profile') => void;
}

export const StudentNavbar: React.FC<StudentNavbarProps> = ({ currentTab, onNavigate }) => {
  const { user, logout, session } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'AL';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#171717] border-b border-neutral-800 shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => onNavigate('dashboard')} 
            className="flex items-center gap-2 focus:outline-none cursor-pointer"
          >
            <BrandLogo size="sm" />
          </button>

          <div className="hidden sm:block h-6 w-px bg-neutral-700"></div>
          <span className="hidden sm:inline-block text-xs font-semibold text-neutral-400">
            Área do Aluno
          </span>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center space-x-1.5 ml-4">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-amber-600/10 text-amber-400 border border-amber-500/20 shadow-xs'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              Início
            </button>

            <button
              onClick={() => onNavigate('course')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'course'
                  ? 'bg-amber-600/10 text-amber-400 border border-amber-500/20 shadow-xs'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Aulas & Conteúdo
            </button>

            <button
              onClick={() => onNavigate('profile')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-amber-600/10 text-amber-400 border border-amber-500/20 shadow-xs'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Meu Perfil
            </button>
          </nav>
        </div>

        {/* Right: Student Details + Avatar + Logout */}
        <div className="hidden md:flex items-center space-x-5">
          <div className="text-right">
            <p className="text-[10px] text-neutral-400 font-medium">Acesso Individual</p>
            <p className="text-xs font-semibold text-neutral-200">{user?.name}</p>
          </div>

          <div className="w-9 h-9 rounded-full bg-neutral-700 border-2 border-amber-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            {userInitials}
          </div>

          <button
            onClick={() => logout()}
            className="bg-neutral-800 hover:bg-neutral-700 p-2 rounded-lg text-neutral-400 hover:text-rose-400 border border-neutral-700/50 transition-all cursor-pointer"
            title="Sair com segurança"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-neutral-300 hover:text-white p-2 rounded-lg bg-neutral-800 border border-neutral-700"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A0A0A] border-b border-neutral-800 px-4 pt-2 pb-5 space-y-2">
          <div className="px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800 mb-2">
            Logado como: <strong className="text-amber-400">{user?.name}</strong>
          </div>

          <button
            onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
              currentTab === 'dashboard' ? 'bg-amber-600/15 text-amber-400 font-semibold' : 'text-neutral-300'
            }`}
          >
            <Home className="w-4 h-4" />
            Dashboard Principal
          </button>

          <button
            onClick={() => { onNavigate('course'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
              currentTab === 'course' ? 'bg-amber-600/15 text-amber-400 font-semibold' : 'text-neutral-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Acessar Aulas do Curso
          </button>

          <button
            onClick={() => { onNavigate('profile'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
              currentTab === 'profile' ? 'bg-amber-600/15 text-amber-400 font-semibold' : 'text-neutral-300'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Meu Perfil & Segurança
          </button>

          <div className="pt-2 border-t border-neutral-800">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
