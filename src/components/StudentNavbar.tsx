import React, { useState, useEffect, useRef } from 'react';
import { 
   BookOpen, User as UserIcon, LogOut, ShieldCheck, 
   Menu, X, Sparkles, Home, HelpCircle, AlertTriangle,
   Bell, CheckCheck, Play, Video
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { SystemNotificationItem } from '../types';

interface StudentNavbarProps {
  currentTab: 'dashboard' | 'course' | 'profile';
  onNavigate: (tab: 'dashboard' | 'course' | 'profile') => void;
  onSelectLesson?: (lessonId: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export const StudentNavbar: React.FC<StudentNavbarProps> = ({ currentTab, onNavigate, onSelectLesson }) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/student/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      /* silently catch network errors */
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleMarkAsRead = async (notificationId: string, lessonId?: string) => {
    try {
      await fetch(`/api/student/notifications/${notificationId}/read`, { method: 'POST' });
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      /* ignore */
    }
    if (lessonId && onSelectLesson) {
      setDropdownOpen(false);
      onSelectLesson(lessonId);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/student/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

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

        {/* Right: Notifications + Student Details + Avatar + Logout */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          {/* Notification Bell Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                if (!dropdownOpen) fetchNotifications();
              }}
              className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                dropdownOpen
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-neutral-800 hover:bg-neutral-700/80 border-neutral-700/60 text-neutral-300 hover:text-white'
              }`}
              title="Notificações de Aulas"
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-neutral-950 shadow-sm shadow-amber-500/50 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-neutral-800 bg-[#141414] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/60">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Notificações</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Marcar lidas
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/60">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center space-y-2">
                      <div className="mx-auto w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500">
                        <Bell className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-medium text-neutral-300">Nenhuma notificação no momento</p>
                      <p className="text-[10px] text-neutral-500 max-w-xs mx-auto">
                        Você receberá avisos aqui sempre que novas aulas e vídeos forem liberados no seu plano.
                      </p>
                    </div>
                  ) : (
                    notifications.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleMarkAsRead(item.id, item.lessonId)}
                        className={`p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                          !item.isRead
                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                            : 'hover:bg-neutral-800/40'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          !item.isRead
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {item.type === 'NEW_PRACTICAL_VIDEO' ? (
                            <Video className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className={`text-xs font-bold truncate ${!item.isRead ? 'text-amber-300' : 'text-neutral-200'}`}>
                              {item.title}
                            </p>
                            <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                            {item.message}
                          </p>
                          {item.moduleTitle && (
                            <span className="inline-block text-[9px] font-semibold text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                              {item.moduleTitle}
                            </span>
                          )}
                        </div>

                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-2" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:block text-right">
            <p className="text-[10px] text-neutral-400 font-medium">Acesso Individual</p>
            <p className="text-xs font-semibold text-neutral-200">{user?.name}</p>
          </div>

          <div className="hidden sm:flex w-9 h-9 rounded-full bg-neutral-700 border-2 border-amber-500 items-center justify-center text-xs font-bold text-white shadow-sm">
            {userInitials}
          </div>

          <button
            onClick={() => logout()}
            className="hidden sm:block bg-neutral-800 hover:bg-neutral-700 p-2 rounded-lg text-neutral-400 hover:text-rose-400 border border-neutral-700/50 transition-all cursor-pointer"
            title="Sair com segurança"
          >
            <LogOut className="w-4 h-4" />
          </button>

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
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A0A0A] border-b border-neutral-800 px-4 pt-2 pb-5 space-y-2">
          <div className="px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800 mb-2 flex items-center justify-between">
            <span>Logado como: <strong className="text-amber-400">{user?.name}</strong></span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {unreadCount} aviso{unreadCount > 1 ? 's' : ''}
              </span>
            )}
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

