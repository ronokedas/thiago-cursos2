import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, LogOut, RefreshCw, 
  Smartphone, Globe, Clock, UserX, AlertTriangle 
} from 'lucide-react';
import { ActiveSessionAdmin } from '../types';

export const AdminSessionsView: React.FC = () => {
  const [sessions, setSessions] = useState<ActiveSessionAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : (data.sessions || []));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Deseja encerrar esta sessão e desconectar o usuário imediatamente?')) return;
    try {
      await fetch(`/api/admin/sessions/${sessionId}/revoke`, { method: 'POST' });
      fetchSessions();
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Central de Sessões & Segurança
          </h1>
          <p className="text-xs text-neutral-400">
            Monitoramento de logins ativos em tempo real com política restrita de sessão única.
          </p>
        </div>

        <button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold rounded-xl border border-neutral-800 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar Sessões</span>
        </button>
      </div>

      {/* Security Info Card */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Política de Proteção Anti-Rateio</h2>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl">
          Cada usuário possui permissão para exatamente 1 sessão ativa simultânea. Quando um aluno efetua login em um novo dispositivo ou navegador, todas as sessões anteriores são revogadas imediatamente no servidor.
        </p>
      </div>

      {/* Sessions Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/80 text-neutral-400 font-semibold border-b border-neutral-800">
              <tr>
                <th className="p-4 pl-6">Usuário</th>
                <th className="p-4">Endereço IP</th>
                <th className="p-4">Dispositivo / Navegador</th>
                <th className="p-4">Conexão Inicial</th>
                <th className="p-4">Última Atividade</th>
                <th className="p-4 pr-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-neutral-500">
                    Nenhuma sessão ativa no momento.
                  </td>
                </tr>
              ) : sessions.map(sess => (
                <tr key={sess.id} className="hover:bg-neutral-800/30 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <div>
                        <p className="font-bold text-white">{sess.userName}</p>
                        <p className="text-[11px] text-neutral-400">{sess.userEmail}</p>
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <span className="font-mono text-neutral-300 bg-neutral-950 px-2 py-1 rounded-md border border-neutral-800">
                      {sess.ipAddress}
                    </span>
                  </td>

                  <td className="p-4">
                    <p className="text-neutral-200 truncate max-w-[200px]" title={sess.device}>
                      {sess.device}
                    </p>
                  </td>

                  <td className="p-4 text-neutral-400 font-mono text-[11px]">
                    {formatDate(sess.createdAt)}
                  </td>

                  <td className="p-4 text-neutral-300 font-mono text-[11px]">
                    {formatDate(sess.lastActivityAt)}
                  </td>

                  <td className="p-4 pr-6 text-right">
                    <button
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Derrubar Conexão
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
