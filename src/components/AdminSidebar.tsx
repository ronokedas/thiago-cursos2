import React from 'react';
import { 
  LayoutDashboard, Users, BookOpen, ShieldCheck, 
  History, Settings, LogOut, Eye, ChevronRight 
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../context/AuthContext';

export type AdminTab = 'dashboard' | 'students' | 'courses' | 'sessions' | 'logs' | 'settings';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onNavigate: (tab: AdminTab) => void;
  onPreviewStudent?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentTab, onNavigate, onPreviewStudent }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'students', label: 'Gestão de Alunos', icon: Users, badge: 'Controle' },
    { id: 'courses', label: 'Cursos & Conteúdo', icon: BookOpen },
    { id: 'sessions', label: 'Sessões & Segurança', icon: ShieldCheck },
    { id: 'logs', label: 'Logs de Auditoria', icon: History },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#101010] border-r border-neutral-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      {/* Top Brand & Badge */}
      <div className="p-5 border-b border-neutral-800">
        <BrandLogo size="sm" />
        <div className="mt-3 flex items-center justify-between bg-amber-600/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
          <span className="text-[11px] font-bold tracking-wider uppercase text-amber-400">
            PAINEL ADMINISTRATIVO
          </span>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        </div>
      </div>

      {/* Nav Menu */}
      <div className="px-3 py-4 flex-1 overflow-y-auto space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
          Navegação Principal
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as AdminTab)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20 font-bold'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions: Switch to Student Preview & Logout */}
      <div className="p-4 border-t border-neutral-800 space-y-2.5 bg-[#0A0A0A]/80">
        {onPreviewStudent && (
          <button
            onClick={onPreviewStudent}
            className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visualizar Como Aluno</span>
          </button>
        )}

        <div className="flex items-center justify-between px-2 pt-2 text-xs">
          <div className="truncate mr-2">
            <p className="text-neutral-200 font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-neutral-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            className="text-neutral-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Sair da Administração"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
