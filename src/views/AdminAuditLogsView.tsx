import React, { useState, useEffect } from 'react';
import { History, Search, RefreshCw, Filter, ShieldCheck, Activity } from 'lucide-react';
import { AuditLogItem } from '../types';

export const AdminAuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const filteredLogs = logs.filter(
    l =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Logs de Auditoria & Rastreabilidade
          </h1>
          <p className="text-xs text-neutral-400">
            Registro imutável de todas as ações administrativas, alterações de validade e eventos de segurança.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold rounded-xl border border-neutral-800 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-neutral-900/70 p-3 rounded-2xl border border-neutral-800 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -tranneutral-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ação, operador ou entidade..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/80 text-neutral-400 font-semibold border-b border-neutral-800">
              <tr>
                <th className="p-4 pl-6">Data / Hora</th>
                <th className="p-4">Ação</th>
                <th className="p-4">Operador</th>
                <th className="p-4">Entidade & Alvo</th>
                <th className="p-4">IP</th>
                <th className="p-4 pr-6">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-neutral-800/30 transition-colors">
                  <td className="p-4 pl-6 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>

                  <td className="p-4">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-amber-400">
                      {log.action}
                    </span>
                  </td>

                  <td className="p-4 font-semibold text-white">
                    {log.actorName}
                  </td>

                  <td className="p-4 text-neutral-300">
                    <span className="font-mono text-neutral-400">{log.entityType}:</span>{' '}
                    <span className="font-bold text-neutral-200">{log.entityId}</span>
                  </td>

                  <td className="p-4 font-mono text-[11px] text-neutral-400">
                    {log.ipAddress}
                  </td>

                  <td className="p-4 pr-6 text-neutral-400 font-mono text-[10px] max-w-xs truncate">
                    {JSON.stringify(log.metadata)}
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
