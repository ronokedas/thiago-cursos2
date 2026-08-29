import React, { Component, ErrorInfo, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './views/LoginView';
import { FirstAccessView } from './views/FirstAccessView';
import { ForgotPasswordView } from './views/ForgotPasswordView';
import { StudentNavbar } from './components/StudentNavbar';
import { StudentDashboard } from './views/StudentDashboard';
import { StudentLessonView } from './views/StudentLessonView';
import { StudentProfileView } from './views/StudentProfileView';
import { AdminSidebar, AdminTab } from './components/AdminSidebar';
import { AdminDashboard } from './views/AdminDashboard';
import { AdminStudentsView } from './views/AdminStudentsView';
import { AdminCoursesView } from './views/AdminCoursesView';
import { AdminSessionsView } from './views/AdminSessionsView';
import { AdminAuditLogsView } from './views/AdminAuditLogsView';
import { AdminSettingsView } from './views/AdminSettingsView';
import { ShieldAlert, ArrowLeft, X } from 'lucide-react';

class AppErrorBoundary extends Component<React.PropsWithChildren<{}>, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro inesperado na interface:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-amber-500/20 bg-[#171717] p-8 text-center shadow-2xl">
          <h1 className="text-xl font-bold text-white">Não foi possível carregar esta tela</h1>
          <p className="mt-3 text-sm text-neutral-400">Atualize a página para tentar novamente. Se o problema continuar, saia e entre novamente no sistema.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-amber-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-amber-500"
          >
            Recarregar sistema
          </button>
        </div>
      </div>
    );
  }
}

const AppContent: React.FC = () => {
  const { user, loading, concurrentSessionAlert, dismissConcurrentAlert } = useAuth();

  // Auth flow states
  const [authView, setAuthView] = useState<'login' | 'forgot_password'>(() => (
    new URLSearchParams(window.location.search).has('resetToken') ? 'forgot_password' : 'login'
  ));

  // Student view states
  const [studentTab, setStudentTab] = useState<'dashboard' | 'course' | 'profile'>('dashboard');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // Admin view states
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [adminPreviewMode, setAdminPreviewMode] = useState(false);

  const openFirstLesson = async () => {
    try {
      const res = await fetch('/api/student/course');
      const data = await res.json();
      const firstLesson = data.modules?.flatMap((module: any) => module.topics || [])
        .flatMap((topic: any) => topic.lessons || [])
        .find((lesson: any) => lesson.access?.allowed && lesson.hasVideo);
      if (firstLesson) setActiveLessonId(firstLesson.id);
    } catch (error) {
      console.error('Não foi possível abrir a primeira aula:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-neutral-400 font-mono tracking-wider">A MECÂNICA • CARREGANDO...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <>
        {concurrentSessionAlert && (
          <div className="fixed top-5 inset-x-0 mx-auto max-w-md z-50 p-4 bg-rose-950 border border-rose-500/50 rounded-2xl shadow-2xl text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Sessão anterior desconectada: login simultâneo detectado ou revogado.</span>
            </div>
            <button onClick={dismissConcurrentAlert} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {authView === 'login' ? (
          <LoginView onForgotPassword={() => setAuthView('forgot_password')} />
        ) : (
          <ForgotPasswordView onBackToLogin={() => setAuthView('login')} />
        )}
      </>
    );
  }

  // Force first password change
  if (user.forcePasswordChange) {
    return <FirstAccessView />;
  }

  // Admin View (unless in Student Preview Mode)
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

  if (isAdmin && !adminPreviewMode) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col md:flex-row text-neutral-100 selection:bg-amber-500 selection:text-white">
        <AdminSidebar
          currentTab={adminTab}
          onNavigate={setAdminTab}
          onPreviewStudent={() => setAdminPreviewMode(true)}
        />

        <main className="flex-1 overflow-y-auto max-h-screen bg-[#0A0A0A]/80">
          {adminTab === 'dashboard' && <AdminDashboard onNavigate={setAdminTab} />}
          {adminTab === 'students' && <AdminStudentsView />}
          {adminTab === 'courses' && <AdminCoursesView />}
          {adminTab === 'sessions' && <AdminSessionsView />}
          {adminTab === 'logs' && <AdminAuditLogsView />}
          {adminTab === 'settings' && <AdminSettingsView />}
        </main>
      </div>
    );
  }

  // Student View (or Admin Previewing Student Experience)
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Admin Preview Floating Bar */}
      {isAdmin && adminPreviewMode && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>MODO DE PRÉ-VISUALIZAÇÃO DE ALUNO ATIVO</span>
          </div>
          <button
            onClick={() => setAdminPreviewMode(false)}
            className="flex items-center gap-1 bg-neutral-900 text-amber-300 px-3 py-1 rounded-lg text-xs font-bold hover:bg-black transition-colors cursor-pointer border border-amber-400/30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel Administrativo</span>
          </button>
        </div>
      )}

      {/* Student Top Navigation */}
      <StudentNavbar
        currentTab={studentTab}
        onNavigate={tab => {
          setStudentTab(tab);
          if (tab === 'dashboard' || tab === 'profile') {
            setActiveLessonId(null);
          } else if (tab === 'course' && !activeLessonId) {
            void openFirstLesson();
          }
        }}
      />

      {/* Main Student Experience */}
      <main className="flex-1 pb-12">
        {activeLessonId ? (
          <StudentLessonView
            lessonId={activeLessonId}
            onSelectLesson={id => setActiveLessonId(id)}
            onBackToDashboard={() => {
              setActiveLessonId(null);
              setStudentTab('dashboard');
            }}
          />
        ) : (
          <>
            {studentTab === 'dashboard' && (
              <StudentDashboard
                onSelectLesson={id => {
                  setActiveLessonId(id);
                  setStudentTab('course');
                }}
                onNavigateToCourse={() => {
                  setStudentTab('course');
                  void openFirstLesson();
                }}
              />
            )}

            {studentTab === 'course' && (
              activeLessonId ? <StudentLessonView
                lessonId={activeLessonId}
                onSelectLesson={id => setActiveLessonId(id)}
                onBackToDashboard={() => { setActiveLessonId(null); setStudentTab('dashboard'); }}
              /> : <div className="mx-auto max-w-xl p-12 text-center text-neutral-300">Nenhuma aula disponível para exibição no momento.</div>
            )}

            {studentTab === 'profile' && <StudentProfileView />}
          </>
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-neutral-800 bg-[#0B1120] py-6 text-center text-xs text-neutral-500 space-y-1">
        <p>© 2026 Mentoria A Mecânica • Trader Thiago. Todos os direitos reservados.</p>
        <p className="text-[10px] text-neutral-600">
          Plataforma de alta segurança com controle de concorrência e rastreabilidade digital.
        </p>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
