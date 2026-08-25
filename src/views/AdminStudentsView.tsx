import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, ShieldAlert, CheckCircle2, 
  XCircle, Clock, KeyRound, LogOut, MoreVertical, Edit, 
  Trash2, Unlock, Lock, RotateCcw, AlertTriangle, X, RefreshCw, Eye, EyeOff, Copy, Check
} from 'lucide-react';
import { User, StudentDetailAdmin, CourseSummary, ModuleSummary } from '../types';

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const formatPhone = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
const formatCpf = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const AdminStudentsView: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New Student Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCpf, setNewCpf] = useState('');
  const [newDurationMonths, setNewDurationMonths] = useState(12);
  const [newAutoPassword, setNewAutoPassword] = useState(true);
  const [newCustomPassword, setNewCustomPassword] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [newUnlockAll, setNewUnlockAll] = useState(false);
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ email: string; tempPassword?: string } | null>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Edit / Detail Student Modal
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetailAdmin | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [courseTree, setCourseTree] = useState<{ course: CourseSummary; modules: ModuleSummary[] } | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const openStudentDetail = async (id: string) => {
    setSelectedStudentId(id);
    setDetailLoading(true);
    try {
      const [detailRes, treeRes] = await Promise.all([
        fetch(`/api/admin/users/${id}`),
        fetch('/api/admin/courses'),
      ]);

      if (detailRes.ok) {
        const d = await detailRes.json();
        setStudentDetail(d);
      }
      if (treeRes.ok) {
        const t = await treeRes.json();
        const course = t.course || t.courses?.[0];
        setCourseTree(course ? { course, modules: course.modules || t.modules || [] } : null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          cpf: newCpf,
          durationMonths: newDurationMonths,
          autoGeneratePassword: newAutoPassword,
          password: newCustomPassword,
          unlockAllImmediately: newUnlockAll,
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreatedResult({
          email: data.user.email,
          tempPassword: data.temporaryPassword || data.generatedPassword,
        });
        setShowCreatedPassword(false);
        setPasswordCopied(false);
        fetchStudents();
      } else {
        alert(data.error || 'Erro ao criar aluno.');
      }
    } catch (e) {
      alert(e instanceof DOMException && e.name === 'AbortError'
        ? 'O cadastro demorou mais que o esperado. Verifique a conexão com o servidor e consulte a lista de alunos antes de tentar novamente.'
        : 'Erro de conexão ao criar aluno.');
    } finally {
      window.clearTimeout(timeoutId);
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!confirm(`Deseja alterar o status do aluno para ${newStatus}?`)) return;
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchStudents();
      if (studentDetail) {
        openStudentDetail(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleUnlockAll = async (id: string, unlockAll: boolean) => {
    const action = unlockAll ? 'Liberar todos os conteúdos (ignorar 7 dias)' : 'Restaurar regra automática de 7 dias';
    if (!confirm(`Deseja ${action} para este aluno?`)) return;
    try {
      await fetch(`/api/admin/users/${id}/override-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: unlockAll ? 'UNLOCK_ALL' : 'RESTORE_RULES' }),
      });
      fetchStudents();
      if (studentDetail) {
        openStudentDetail(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm('Deseja resetar a senha deste aluno e gerar uma nova senha temporária?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: true }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Nova senha temporária gerada: ${data.temporaryPassword}\nO aluno deverá alterar no próximo login.`);
        fetchStudents();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDropSession = async (id: string) => {
    if (!confirm('Deseja desconectar a sessão ativa deste aluno?')) return;
    try {
      await fetch(`/api/admin/users/${id}/revoke-session`, { method: 'POST' });
      alert('Sessão revogada com sucesso.');
      fetchStudents();
      if (studentDetail) {
        openStudentDetail(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleContentOverride = async (userId: string, contentType: 'MODULE' | 'LESSON', contentId: string, action: 'ALLOW' | 'DENY' | 'REMOVE') => {
    try {
      await fetch(`/api/admin/users/${userId}/override-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          contentId,
          action,
        }),
      });
      openStudentDetail(userId);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestão de Alunos</h1>
          <p className="text-xs text-neutral-400">
            Cadastre novos alunos, controle validades de acesso, gerencie exceções e monitore sessões.
          </p>
        </div>

        <button
          onClick={() => {
            setCreatedResult(null);
            setCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-900/20 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Aluno</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/70 p-3 rounded-2xl border border-neutral-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -tranneutral-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="EXPIRED">Expirados</option>
            <option value="SUSPENDED">Suspensos</option>
            <option value="BLOCKED">Bloqueados</option>
          </select>

          <button
            onClick={fetchStudents}
            className="p-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl border border-neutral-800 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/80 text-neutral-400 font-semibold border-b border-neutral-800">
              <tr>
                <th className="p-4 pl-6">Aluno</th>
                <th className="p-4">Status</th>
                <th className="p-4">Regra 7 Dias</th>
                <th className="p-4">Validade</th>
                <th className="p-4">Progresso</th>
                <th className="p-4 pr-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-neutral-800/30 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-white">{student.name}</p>
                        <p className="text-[11px] text-neutral-400">{student.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        student.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : student.status === 'EXPIRED'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {student.status === 'ACTIVE' && 'Ativo'}
                      {student.status === 'EXPIRED' && 'Expirado'}
                      {student.status === 'SUSPENDED' && 'Suspenso'}
                      {student.status === 'BLOCKED' && 'Bloqueado'}
                    </span>
                  </td>

                  <td className="p-4">
                    {student.unlockAllImmediately ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                        <Unlock className="w-3 h-3" />
                        Tudo Liberado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                        <Clock className="w-3 h-3" />
                        Automático (7d)
                      </span>
                    )}
                  </td>

                  <td className="p-4">
                    <p className="text-neutral-200 font-medium">
                      {new Date(student.expirationDate).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      Início: {new Date(student.startDate).toLocaleDateString('pt-BR')}
                    </p>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${student.progressPercent || 0}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {student.progressPercent || 0}%
                      </span>
                    </div>
                  </td>

                  <td className="p-4 pr-6 text-right">
                    <button
                      onClick={() => openStudentDetail(student.id)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STUDENT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Cadastrar Novo Aluno</h2>
                <p className="text-xs text-neutral-400">Insira os dados do aluno para criar o acesso na mentoria.</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdResult ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl space-y-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Aluno Cadastrado com Sucesso!</h3>
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 text-left space-y-2 text-xs">
                  <p><span className="text-neutral-400">E-mail:</span> <strong className="text-white">{createdResult.email}</strong></p>
                  {createdResult.tempPassword && (
                    <div className="space-y-2">
                      <span className="text-neutral-400">Senha inicial do aluno:</span>
                      <div className="flex items-center gap-2">
                        <strong className="flex-1 text-amber-400 font-mono text-sm bg-neutral-900 px-2 py-2 rounded border border-neutral-800 break-all">
                          {showCreatedPassword ? createdResult.tempPassword : '••••••••••••'}
                        </strong>
                        <button type="button" onClick={() => setShowCreatedPassword(value => !value)} className="p-2 text-neutral-300 hover:text-white" title="Mostrar ou ocultar senha">
                          {showCreatedPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={async () => { await navigator.clipboard.writeText(createdResult.tempPassword || ''); setPasswordCopied(true); }} className="p-2 text-neutral-300 hover:text-amber-400" title="Copiar senha">
                          {passwordCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-400 pt-1">
                    Copie esta senha agora e informe ao aluno. Por segurança, ela não poderá ser recuperada depois. O aluno deverá alterá-la no primeiro login.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreatedResult(null);
                  }}
                  className="w-full py-2.5 bg-amber-500 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-300">E-mail de Acesso *</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value.trim().toLowerCase())}
                      placeholder="aluno@email.com"
                      className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-300">WhatsApp / Telefone</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={e => setNewPhone(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-300">CPF (Opcional - Marca D'Água)</label>
                    <input
                      type="text"
                      value={newCpf}
                      onChange={e => setNewCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-neutral-300">Duração do Acesso</label>
                    <select
                      value={newDurationMonths}
                      onChange={e => setNewDurationMonths(parseInt(e.target.value))}
                      className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value={1}>1 Mês (30 dias)</option>
                      <option value={3}>3 Meses (90 dias)</option>
                      <option value={6}>6 Meses</option>
                      <option value={12}>12 Meses (1 Ano - Padrão)</option>
                      <option value={24}>24 Meses (2 Anos)</option>
                      <option value={60}>Acesso Vitalício (5 Anos)</option>
                    </select>
                  </div>
                </div>

                {/* Password Generation */}
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={newAutoPassword}
                      onChange={e => setNewAutoPassword(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span>Gerar senha temporária forte automaticamente</span>
                  </label>

                  {!newAutoPassword && (
                    <div className="relative mt-2">
                      <input
                        type={showCustomPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newCustomPassword}
                        onChange={e => setNewCustomPassword(e.target.value)}
                        placeholder="Definir senha inicial personalizada"
                        className="w-full px-3 py-2 pr-10 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                      />
                      <button type="button" onClick={() => setShowCustomPassword(value => !value)} className="absolute right-3 top-1/2 -tranneutral-y-1/2 text-neutral-500 hover:text-white" title="Mostrar ou ocultar senha">
                        {showCustomPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Unlock all immediately checkbox */}
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer text-amber-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={newUnlockAll}
                      onChange={e => setNewUnlockAll(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span>Liberar todo o conteúdo antecipadamente (ignorar 7 dias)</span>
                  </label>
                  <p className="text-[10px] text-amber-400/80 pl-5">
                    Se desmarcado, a regra padrão de proteção de 7 dias será aplicada automaticamente.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-300">Observações Internas (Admin)</label>
                  <textarea
                    rows={2}
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    placeholder="Notas internas da equipe..."
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    {creating ? 'Cadastrando...' : 'Criar Aluno'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* STUDENT DETAIL & OVERRIDES MODAL */}
      {selectedStudentId && studentDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{studentDetail.user.name}</h2>
                <p className="text-xs text-neutral-400">{studentDetail.user.email} • ID: {studentDetail.user.id}</p>
              </div>
              <button
                onClick={() => setSelectedStudentId(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => handleResetPassword(studentDetail.user.id)}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-200 font-semibold"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Resetar Senha</span>
              </button>

              <button
                onClick={() => handleDropSession(studentDetail.user.id)}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-200 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Derrubar Sessão</span>
              </button>

              {studentDetail.user.unlockAllImmediately ? (
                <button
                  onClick={() => handleToggleUnlockAll(studentDetail.user.id, false)}
                  className="flex items-center justify-center gap-1.5 p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar 7 Dias</span>
                </button>
              ) : (
                <button
                  onClick={() => handleToggleUnlockAll(studentDetail.user.id, true)}
                  className="flex items-center justify-center gap-1.5 p-2.5 bg-amber-500 hover:bg-amber-400 rounded-xl text-neutral-950 font-bold"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Liberar Tudo Já</span>
                </button>
              )}

              <select
                value={studentDetail.user.status}
                onChange={e => handleUpdateStatus(studentDetail.user.id, e.target.value)}
                className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 font-semibold focus:outline-none"
              >
                <option value="ACTIVE">Status: Ativo</option>
                <option value="SUSPENDED">Status: Suspenso</option>
                <option value="EXPIRED">Status: Expirado</option>
                <option value="BLOCKED">Status: Bloqueado</option>
              </select>
            </div>

            {/* Content Overrides (Individual module / lesson unlocks) */}
            <div className="bg-neutral-950/80 p-5 rounded-2xl border border-neutral-800 space-y-3 text-xs">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Exceções Individuais de Conteúdo (ALLOW / DENY)
              </h3>
              <p className="text-[11px] text-neutral-400">
                Você pode liberar ou bloquear módulos/aulas específicas apenas para este aluno, sem alterar as regras do restante da turma.
              </p>

              {courseTree?.modules.map(mod => {
                const override = studentDetail.overrides.find(
                  o => o.contentType === 'MODULE' && o.contentId === mod.id
                );

                return (
                  <div key={mod.id} className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{mod.title}</p>
                      <p className="text-[10px] text-neutral-400">Regra global: {mod.releaseRule}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {override ? (
                        <button
                          onClick={() => handleToggleContentOverride(studentDetail.user.id, 'MODULE', mod.id, 'REMOVE')}
                          className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold"
                        >
                          Exceção: {override.action} (Remover)
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggleContentOverride(studentDetail.user.id, 'MODULE', mod.id, 'ALLOW')}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 rounded text-[11px] font-semibold"
                          >
                            + Liberar
                          </button>
                          <button
                            onClick={() => handleToggleContentOverride(studentDetail.user.id, 'MODULE', mod.id, 'DENY')}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-rose-400 rounded text-[11px] font-semibold"
                          >
                            + Bloquear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
