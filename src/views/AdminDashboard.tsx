import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, UserX, Clock, ShieldCheck, 
  BookOpen, Video, Activity, AlertTriangle, ArrowUpRight, Sparkles 
} from 'lucide-react';
import { AdminStats, AuditLogItem } from '../types';
import { AdminTab } from '../components/AdminSidebar';

interface AdminDashboardProps {
  onNavigate: (tab: AdminTab) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          fetch('/api/admin/metrics'),
          fetch('/api/admin/audit-logs?limit=5'),
        ]);

        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }
        if (logsRes.ok) {
          const l = await logsRes.json();
          setLogs(l.logs || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Painel Geral da Mentoria
          </h1>
          <p className="text-xs text-neutral-400">
            Controle operacional, métricas de engajamento, sessões ativas e proteção anti-vazamento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('students')}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-900/20 cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Cadastrar Novo Aluno</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Total de Alunos</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-white">{stats.totalStudents}</p>
            <span className="text-[11px] text-emerald-400 font-medium">{stats.activeStudents} ativos</span>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Sessões Conectadas</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-emerald-400">{stats.activeSessions}</p>
            <span className="text-[11px] text-neutral-400 font-medium">Sessão Única Ativa</span>
          </div>
        </div>

        {/* Total Lessons & Content */}
        <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Aulas no Curso</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-white">{stats.totalLessons}</p>
            <span className="text-[11px] text-neutral-400 font-medium">{stats.totalModules} módulos</span>
          </div>
        </div>

        {/* Expired / Suspended */}
        <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Expirados / Bloqueados</span>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-rose-400">
              {stats.expiredStudents + stats.suspendedStudents}
            </p>
            <span className="text-[11px] text-neutral-400 font-medium">Acesso restrito</span>
          </div>
        </div>
      </div>

      {/* Security Status Box */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Central de Proteção e Segurança</h2>
              <p className="text-xs text-neutral-400">Todas as camadas ativas</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('sessions')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver Gerenciador de Sessões</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800/80 space-y-1">
            <p className="text-xs font-bold text-white">Marca D'Água Dinâmica</p>
            <p className="text-[11px] text-neutral-400">
              Sobreposição flutuante de CPF/Nome/IP nos vídeos a cada 15 segundos.
            </p>
          </div>
          <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800/80 space-y-1">
            <p className="text-xs font-bold text-white">Streaming Privado (HTTP 206)</p>
            <p className="text-[11px] text-neutral-400">
              Tickets efêmeros de 60s com verificação contínua de token de sessão.
            </p>
          </div>
          <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800/80 space-y-1">
            <p className="text-xs font-bold text-white">Liberação 7 Dias Automática</p>
            <p className="text-[11px] text-neutral-400">
              Controle progressivo a partir da data de matrícula do aluno.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Audit Trail Preview */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Últimas Atividades Registradas</h2>
          </div>
          <button
            onClick={() => onNavigate('logs')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Ver todos os logs
          </button>
        </div>

        <div className="space-y-2">
          {logs.map(log => (
            <div
              key={log.id}
              className="flex items-center justify-between p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/60 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-amber-400 font-bold">
                  {log.action}
                </span>
                <span className="text-neutral-300">
                  <strong className="text-white">{log.actorName}</strong> realizou {log.action} em {log.entityType} ({log.entityId})
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                {new Date(log.createdAt).toLocaleTimeString('pt-BR')} • {log.ipAddress}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
