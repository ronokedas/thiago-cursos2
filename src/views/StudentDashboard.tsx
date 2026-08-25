import React, { useState, useEffect } from 'react';
import { 
  Play, CheckCircle2, Lock, Clock, Calendar, 
  Award, ChevronRight, ShieldCheck, AlertCircle, Sparkles, BookOpen 
} from 'lucide-react';
import { StudentDashboardData, CourseSummary, ModuleSummary } from '../types';
import { useAuth } from '../context/AuthContext';

interface StudentDashboardProps {
  onSelectLesson: (lessonId: string) => void;
  onNavigateToCourse: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onSelectLesson, onNavigateToCourse }) => {
  const { user } = useAuth();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [courseData, setCourseData] = useState<{ course: CourseSummary; modules: ModuleSummary[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, courseRes] = await Promise.all([
          fetch('/api/student/dashboard'),
          fetch('/api/student/course'),
        ]);

        if (dashRes.ok) {
          const d = await dashRes.json();
          setData(d);
        }
        if (courseRes.ok) {
          const c = await courseRes.json();
          setCourseData(c);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-neutral-400 font-mono">CARREGANDO PLANO DE ESTUDOS...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatDate = (iso: string) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Notice Banner if active */}
      {data.settings.noticeBanner && (
        <div className="bg-amber-600/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-medium">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{data.settings.noticeBanner}</span>
        </div>
      )}

      {/* Hero Welcome & Stats Card */}
      <div className="relative overflow-hidden bg-[#171717] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Subtle glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Left Column: Greeting & Progress */}
          <div className="lg:col-span-2 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-600/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Acesso Individual Homologado</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Olá, <span className="text-amber-400">{data.student.name}</span>!
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 font-medium leading-relaxed max-w-xl">
                Seu plano de mentoria está ativo. Mantenha a disciplina no gerenciamento de risco e avance pelas aulas na ordem recomendada.
              </p>
            </div>

            {/* Access Validity Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#0A0A0A] border border-neutral-800 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2 text-neutral-400 text-[11px] font-medium mb-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Validade do Acesso
                </div>
                <p className="text-sm font-bold text-white">
                  Até {formatDate(data.student.expirationDate)}
                </p>
              </div>

              <div className="bg-[#0A0A0A] border border-neutral-800 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2 text-neutral-400 text-[11px] font-medium mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Dias Restantes
                </div>
                <p className="text-sm font-bold text-amber-400">
                  {data.student.daysUntilExpiration} dias
                </p>
              </div>

              <div className="bg-[#0A0A0A] border border-neutral-800 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2 text-neutral-400 text-[11px] font-medium mb-1">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  Progresso Concluído
                </div>
                <p className="text-sm font-bold text-emerald-400">
                  {data.metrics.progressPercent}% ({data.metrics.completedLessons}/{data.metrics.totalLessons} aulas)
                </p>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-semibold text-neutral-400">
                <span>Evolução do Curso</span>
                <span className="text-amber-400">{data.metrics.progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#0A0A0A] rounded-full overflow-hidden border border-neutral-800">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                  style={{ width: `${data.metrics.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: "Continuar Estudando" Quick Action Card */}
          <div className="bg-[#0A0A0A] border border-neutral-800 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-xl">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Última Aula em Andamento
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white line-clamp-2">
                {data.lastWatchedLesson ? data.lastWatchedLesson.title : 'Aula 01: Boas-Vindas à Mentoria'}
              </h2>
              <p className="text-xs text-neutral-400 line-clamp-1">
                {data.lastWatchedLesson ? data.lastWatchedLesson.moduleTitle : 'Módulo 1: Introdução'}
              </p>
            </div>

            <button
              onClick={() => {
                if (data.lastWatchedLesson) {
                  onSelectLesson(data.lastWatchedLesson.id);
                } else {
                  onNavigateToCourse();
                }
              }}
              className="w-full flex items-center justify-center gap-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Continuar Estudando</span>
            </button>
          </div>
        </div>
      </div>

      {/* Course Structure & Progressive Unlock Status */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Grade Curricular & Liberação de Módulos
            </h2>
            <p className="text-xs text-neutral-400">
              Aulas liberadas e conteúdos com liberação automática de 7 dias.
            </p>
          </div>

          <button
            onClick={onNavigateToCourse}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>Ver Grade Completa</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {courseData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courseData.modules.map(module => {
              const isAllowed = module.access.allowed;
              const daysRemaining = module.access.daysRemaining;

              return (
                <div
                  key={module.id}
                  className={`flex flex-col justify-between p-6 rounded-2xl border transition-all ${
                    isAllowed
                      ? 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700 shadow-lg'
                      : 'bg-neutral-800/20 border-neutral-800/60 opacity-80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                        MÓDULO {module.position}
                      </span>

                      {isAllowed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Liberado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-600/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <Lock className="w-3 h-3" />
                          Liberação em {daysRemaining || 7} dias
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-1">
                      {module.title}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {module.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-4 border-t border-neutral-800">
                    {isAllowed ? (
                      <button
                        onClick={() => {
                          const firstLesson = module.topics[0]?.lessons[0];
                          if (firstLesson) onSelectLesson(firstLesson.id);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>Acessar Módulo</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 px-3 bg-neutral-900/60 text-neutral-500 rounded-xl text-xs font-medium border border-neutral-800">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Disponível após o 7º dia</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
