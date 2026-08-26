import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Plus, Edit, Trash2, Video, Upload, 
  Clock, Lock, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, X, Play 
} from 'lucide-react';
import { CourseSummary, ModuleSummary, LessonSummary } from '../types';

async function readApiPayload(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { error: `O servidor respondeu de forma inválida (${response.status}): ${raw.slice(0, 180)}` }; }
}

export const AdminCoursesView: React.FC = () => {
  const [courseTree, setCourseTree] = useState<{ course: CourseSummary; modules: ModuleSummary[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // Module Modal
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDesc, setModuleDesc] = useState('');
  const [moduleRule, setModuleRule] = useState<'IMMEDIATE' | 'AFTER_DAYS' | 'FIXED_DATE' | 'MANUAL'>('IMMEDIATE');
  const [moduleDays, setModuleDays] = useState(7);
  const [moduleDate, setModuleDate] = useState('');

  // Topic modal
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDesc, setTopicDesc] = useState('');

  // Lesson & Video Upload Modal
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [lessonDuration, setLessonDuration] = useState(600);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [practicalDrafts, setPracticalDrafts] = useState<Array<{ title: string; description: string; file: File | null }>>([]);
  const [imageDrafts, setImageDrafts] = useState<Array<{ title: string; description: string; original: File | null; corrected: File | null }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadBytes, setUploadBytes] = useState({ loaded: 0, total: 0 });
  const [uploadStatus, setUploadStatus] = useState('');
  const activeUploadRef = useRef<XMLHttpRequest | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/courses');
      if (res.ok) {
        const data = await res.json();
        setCourseTree(data);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível salvar o módulo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const editingLesson = editingLessonId
    ? courseTree?.modules.flatMap(module => module.topics.flatMap(topic => topic.lessons))
      .find(lesson => lesson.id === editingLessonId)
    : null;

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTree) return;
    try {
      if (editingModuleId) {
        const response = await fetch(`/api/admin/modules/${editingModuleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: moduleTitle,
            description: moduleDesc,
            releaseType: moduleRule,
            releaseDays: moduleDays,
            releaseDate: moduleDate || null,
          }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível salvar o módulo.');
      } else {
        const response = await fetch('/api/admin/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: courseTree.course.id,
            title: moduleTitle,
            description: moduleDesc,
            releaseType: moduleRule,
            releaseDays: moduleDays,
            releaseDate: moduleDate || null,
          }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível salvar o módulo.');
      }
      setModuleModalOpen(false);
      setEditingModuleId(null);
      fetchTree();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível salvar o módulo.');
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Deseja excluir este módulo e todos os seus tópicos/aulas?')) return;
    try {
      const response = await fetch(`/api/admin/modules/${moduleId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível excluir o módulo.');
      fetchTree();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível excluir o módulo.');
    }
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) return;
    const url = editingTopicId ? `/api/admin/topics/${editingTopicId}` : '/api/admin/topics';
    const method = editingTopicId ? 'PUT' : 'POST';
    const body = editingTopicId
      ? { title: topicTitle, description: topicDesc }
      : { moduleId: selectedModuleId, title: topicTitle, description: topicDesc };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const data = await res.json(); alert(data.error || 'Não foi possível salvar o tópico.'); return; }
    setTopicModalOpen(false);
    setEditingTopicId(null);
    setTopicTitle('');
    setTopicDesc('');
    fetchTree();
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Deseja excluir este tópico e todas as suas aulas?')) return;
    const res = await fetch(`/api/admin/topics/${topicId}`, { method: 'DELETE' });
    if (!res.ok) { const data = await res.json(); alert(data.error || 'Não foi possível excluir o tópico.'); return; }
    fetchTree();
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId) return;

    const parentModule = courseTree?.modules.find(module =>
      module.topics.some(topic => topic.id === selectedTopicId)
    );
    if (!parentModule) {
      setLessonError('Não foi possível identificar o módulo deste tópico. Recarregue a página e tente novamente.');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setUploadBytes({ loaded: 0, total: videoFile?.size || 0 });
    setUploadStatus('Salvando dados da aula...');
    setLessonError(null);

    try {
      // 1. Create or update lesson
      const res = await fetch(editingLessonId ? `/api/admin/lessons/${editingLessonId}` : '/api/admin/lessons', {
        method: editingLessonId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopicId,
          moduleId: parentModule.id,
          title: lessonTitle,
          description: lessonDesc,
          durationSeconds: lessonDuration,
          releaseType: 'IMMEDIATE',
        }),
      });

      const lessonData = await readApiPayload(res);
      if (!res.ok) {
        throw new Error(lessonData.error || 'Não foi possível cadastrar a aula.');
      }
      setUploadProgress(videoFile ? 20 : 85);

      // 2. If video file selected, upload video
      const savedLessonId = lessonData.lesson?.id || editingLessonId;
      if (videoFile && savedLessonId) {
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('durationSeconds', lessonDuration.toString());

        setUploadStatus('Enviando vídeo...');
        const uploadData = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeUploadRef.current = xhr;
          xhr.open('POST', `/api/admin/lessons/${savedLessonId}/upload-video`);
          xhr.withCredentials = true;
          xhr.upload.onprogress = event => {
            if (!event.lengthComputable) return;
            setUploadBytes({ loaded: event.loaded, total: event.total });
            setUploadProgress(20 + Math.round((event.loaded / event.total) * 65));
            if (event.loaded === event.total) setUploadStatus('Otimizando vídeo para reprodução...');
          };
          xhr.onload = () => {
            activeUploadRef.current = null;
            let payload: any = {};
            try { payload = JSON.parse(xhr.responseText || '{}'); } catch { /* handled below */ }
            if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
            else reject(new Error(payload.error || 'O upload do vídeo falhou.'));
          };
          xhr.onerror = () => { activeUploadRef.current = null; reject(new Error('Falha de conexão durante o upload.')); };
          xhr.onabort = () => { activeUploadRef.current = null; reject(new Error('Upload cancelado.')); };
          xhr.send(formData);
        });
      }

      // 3. If a supplementary material was selected, upload it to the lesson
      if (materialFile && savedLessonId) {
        const materialFormData = new FormData();
        materialFormData.append('file', materialFile);
        const materialRes = await fetch(`/api/admin/lessons/${savedLessonId}/materials`, {
          method: 'POST',
          body: materialFormData,
        });
        const materialData = await readApiPayload(materialRes);
        if (!materialRes.ok) {
          throw new Error(materialData.error || 'A aula foi salva, mas o material não pôde ser enviado.');
        }
      }

      // 4. Complementary media is persisted sequentially after the lesson ID
      // exists, so a failed file never prevents the lesson itself from being saved.
      if (savedLessonId) {
        for (const draft of practicalDrafts.filter(item => item.file)) {
          const form = new FormData(); form.append('title', draft.title || draft.file!.name); form.append('description', draft.description); form.append('video', draft.file!);
          setUploadStatus(`Enviando vídeo prático: ${draft.title || draft.file!.name}`);
          const response = await fetch(`/api/admin/lessons/${savedLessonId}/practical-videos`, { method: 'POST', body: form }); const data = await readApiPayload(response); if (!response.ok) throw new Error(data.error || 'A aula foi salva, mas um vídeo prático falhou.');
        }
        for (const draft of imageDrafts.filter(item => item.original)) {
          const form = new FormData(); form.append('title', draft.title || draft.original!.name); form.append('description', draft.description); form.append('original', draft.original!); if (draft.corrected) form.append('corrected', draft.corrected);
          setUploadStatus(`Enviando exercício: ${draft.title || draft.original!.name}`);
          const response = await fetch(`/api/admin/lessons/${savedLessonId}/image-exercises`, { method: 'POST', body: form }); const data = await readApiPayload(response); if (!response.ok) throw new Error(data.error || 'A aula foi salva, mas um exercício de imagens falhou.');
        }
      }

      setUploadStatus(materialFile ? 'Enviando material complementar...' : 'Vídeo pronto para reprodução.');
      setUploadProgress(100);
      setLessonModalOpen(false);
      setEditingLessonId(null);
      setVideoFile(null);
      setMaterialFile(null);
      setPracticalDrafts([]); setImageDrafts([]);
      setLessonTitle('');
      setLessonDesc('');
      fetchTree();
    } catch (e) {
      setLessonError(e instanceof Error ? e.message : 'Erro ao criar aula.');
    } finally {
      activeUploadRef.current = null;
      setUploading(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Deseja excluir esta aula?')) return;
    try {
      const response = await fetch(`/api/admin/lessons/${lessonId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível excluir a aula.');
      fetchTree();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível excluir a aula.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Gestão do Curso & Vídeos
          </h1>
          <p className="text-xs text-neutral-400">
            Estrutura de módulos, tópicos, aulas, regras de liberação progressiva (7 dias) e vídeos protegidos.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingModuleId(null);
            setModuleTitle('');
            setModuleDesc('');
            setModuleRule('IMMEDIATE');
            setModuleDays(7);
            setModuleDate('');
            setModuleModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-900/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Módulo</span>
        </button>
      </div>

      {/* Modules List */}
      <div className="space-y-6">
        {courseTree?.modules.map(module => (
          <div
            key={module.id}
            className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 space-y-5 shadow-xl"
          >
            {/* Module Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-neutral-800 text-amber-400">
                    MÓDULO {module.position}
                  </span>
                  <h2 className="text-base font-bold text-white">{module.title}</h2>
                </div>
                <p className="text-xs text-neutral-400 max-w-2xl">{module.description}</p>
              </div>

              {/* Release Rule Badge & Actions */}
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    module.releaseRule === 'IMMEDIATE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {module.releaseRule === 'IMMEDIATE' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Liberado Imediatamente</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Liberação Automática aos 7 Dias</span>
                    </>
                  )}
                </span>

                <button
                  onClick={() => {
                    setSelectedModuleId(module.id);
                    setEditingTopicId(null);
                    setTopicTitle('');
                    setTopicDesc('');
                    setTopicModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-lg text-[11px] font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Tópico
                </button>

                <button
                  onClick={() => {
                    setEditingModuleId(module.id);
                    setModuleTitle(module.title);
                    setModuleDesc(module.description);
                    setModuleRule(['IMMEDIATE', 'AFTER_DAYS', 'FIXED_DATE', 'MANUAL'].includes(module.releaseRule) ? module.releaseRule as 'IMMEDIATE' | 'AFTER_DAYS' | 'FIXED_DATE' | 'MANUAL' : 'IMMEDIATE');
                    setModuleDays(module.releaseDays || 7);
                    setModuleDate(module.releaseDate ? module.releaseDate.slice(0, 16) : '');
                    setModuleModalOpen(true);
                  }}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                  title="Editar Módulo"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDeleteModule(module.id)}
                  className="p-2 bg-neutral-800 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 rounded-lg text-xs"
                  title="Excluir Módulo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Topics and Lessons */}
            <div className="space-y-4">
              {module.topics.map(topic => (
                <div key={topic.id} className="bg-neutral-950/60 rounded-2xl p-4 border border-neutral-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      {topic.title}
                    </h3>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setEditingTopicId(topic.id); setSelectedModuleId(module.id); setTopicTitle(topic.title); setTopicDesc(topic.description || ''); setTopicModalOpen(true); }} className="text-[11px] text-neutral-400 hover:text-white">Editar tópico</button>
                      <button type="button" onClick={() => handleDeleteTopic(topic.id)} className="text-[11px] text-rose-400 hover:text-rose-300">Excluir</button>
                      <button
                        onClick={() => { setEditingLessonId(null); setSelectedTopicId(topic.id); setLessonTitle(''); setLessonDesc(''); setLessonDuration(600); setVideoFile(null); setMaterialFile(null); setLessonError(null); setLessonModalOpen(true); }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300"
                      >
                        <Plus className="w-3.5 h-3.5" /> <span>Adicionar Aula</span>
                      </button>
                    </div>
                  </div>

                  {/* Lessons Grid / Table */}
                  <div className="space-y-2">
                    {topic.lessons.map(lesson => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between p-3 bg-neutral-900/90 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{lesson.title}</p>
                            <p className="text-[11px] text-neutral-500">
                              Duração: {Math.floor(lesson.durationSeconds / 60)} min • Streaming Privado Ativo
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => { setEditingLessonId(lesson.id); setSelectedTopicId(topic.id); setLessonTitle(lesson.title); setLessonDesc(lesson.description || ''); setLessonDuration(lesson.durationSeconds); setVideoFile(null); setMaterialFile(null); setLessonError(null); setLessonModalOpen(true); }} className="p-1.5 text-neutral-500 hover:text-amber-400 rounded transition-colors" title="Editar Aula"><Edit className="w-3.5 h-3.5" /></button>
                          <button
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="p-1.5 text-neutral-500 hover:text-rose-400 rounded transition-colors"
                            title="Excluir Aula"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* MODULE CREATE / EDIT MODAL */}
      {topicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="flex h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4 sm:px-7">
              <h2 className="text-base font-bold text-white">{editingTopicId ? 'Editar Tópico' : 'Novo Tópico'}</h2>
              <button type="button" onClick={() => setTopicModalOpen(false)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
              <input required value={topicTitle} onChange={e => setTopicTitle(e.target.value)} placeholder="Título do tópico" className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <textarea value={topicDesc} onChange={e => setTopicDesc(e.target.value)} placeholder="Descrição do tópico" rows={3} className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />
              <div className="flex gap-2"><button type="button" onClick={() => setTopicModalOpen(false)} className="flex-1 py-2.5 bg-neutral-800 text-neutral-300 rounded-xl">Cancelar</button><button type="submit" className="flex-1 py-2.5 bg-amber-500 text-neutral-950 font-bold rounded-xl">Salvar Tópico</button></div>
            </form>
          </div>
        </div>
      )}

      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingModuleId ? 'Editar Módulo' : 'Novo Módulo'}
              </h2>
              <button onClick={() => setModuleModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-300">Título do Módulo *</label>
                <input
                  type="text"
                  required
                  value={moduleTitle}
                  onChange={e => setModuleTitle(e.target.value)}
                  placeholder="Ex: Módulo 1 — Fundamentos da Mecânica"
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-300">Descrição</label>
                <textarea
                  rows={3}
                  value={moduleDesc}
                  onChange={e => setModuleDesc(e.target.value)}
                  placeholder="Breve descrição dos tópicos abordados..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Release Rule Selector */}
              <div className="space-y-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <label className="font-semibold text-neutral-200 block">Regra de Liberação</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="rule"
                      value="IMMEDIATE"
                      checked={moduleRule === 'IMMEDIATE'}
                      onChange={() => setModuleRule('IMMEDIATE')}
                      className="accent-amber-500"
                    />
                    <span>Liberar Imediatamente no 1º Dia</span>
                  </label>

                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="rule"
                      value="AFTER_DAYS"
                      checked={moduleRule === 'AFTER_DAYS'}
                      onChange={() => setModuleRule('AFTER_DAYS')}
                      className="accent-amber-500"
                    />
                    <span>Liberação Automática após 7 Dias (Padrão de Segurança)</span>
                  </label>
                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer"><input type="radio" name="rule" value="FIXED_DATE" checked={moduleRule === 'FIXED_DATE'} onChange={() => setModuleRule('FIXED_DATE')} className="accent-amber-500" /><span>Liberar em data específica</span></label>
                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer"><input type="radio" name="rule" value="MANUAL" checked={moduleRule === 'MANUAL'} onChange={() => setModuleRule('MANUAL')} className="accent-amber-500" /><span>Somente liberação manual</span></label>
                </div>
              </div>

              {moduleRule === 'AFTER_DAYS' && <input type="number" min="0" max="3650" value={moduleDays} onChange={e => setModuleDays(Number(e.target.value) || 0)} placeholder="Dias" className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />}
              {moduleRule === 'FIXED_DATE' && <input type="datetime-local" required value={moduleDate} onChange={e => setModuleDate(e.target.value)} className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100" />}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModuleModalOpen(false)}
                  className="flex-1 py-2.5 bg-neutral-800 text-neutral-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 text-neutral-950 font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Salvar Módulo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LESSON & VIDEO UPLOAD MODAL */}
      {lessonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-white">{editingLessonId ? 'Editar Aula & Vídeo' : 'Adicionar Nova Aula & Vídeo'}</h2>
              <button onClick={() => setLessonModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLesson} className="flex min-h-0 flex-1 flex-col text-xs">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-300">Título da Aula *</label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  placeholder="Ex: Aula 01 — Estrutura de Mercado"
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-300">Descrição da Aula</label>
                <textarea
                  rows={2}
                  value={lessonDesc}
                  onChange={e => setLessonDesc(e.target.value)}
                  placeholder="Instruções para o aluno..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-300">Duração Estimada (Segundos)</label>
                <input
                  type="number"
                  value={lessonDuration}
                  onChange={e => setLessonDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Video File Upload */}
              <div className="space-y-1">
                <label className="font-semibold text-neutral-300">Arquivo de Vídeo (MP4/WebM)</label>
                {editingLesson?.videoFileName && (
                  <p className="text-[10px] text-emerald-400 break-all">
                    Arquivo atual: {editingLesson.videoFileName}
                    {editingLesson.videoUploadedAt ? ` • enviado em ${new Date(editingLesson.videoUploadedAt).toLocaleString('pt-BR')}` : ''}
                  </p>
                )}
                <input
                  type="file"
                  accept=".mp4,video/mp4"
                  onChange={e => setVideoFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
                />
                <p className="text-[10px] text-neutral-500">
                  O vídeo será salvo em storage privado e protegido com streaming dinâmico.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-300">Material Complementar (PDF ou documento)</label>
                {editingLesson?.supplementaryMaterials?.length ? (
                  <div className="space-y-1">
                    {editingLesson.supplementaryMaterials.map(material => (
                      <p key={material.id} className="text-[10px] text-emerald-400 break-all">
                        Arquivo atual: {material.title}
                      </p>
                    ))}
                  </div>
                ) : null}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => setMaterialFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
                />
                <p className="text-[10px] text-neutral-500">
                  O arquivo ficará privado e será disponibilizado para download apenas aos alunos autorizados (limite de 25 MB).
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
                <div className="flex items-center justify-between"><label className="font-semibold text-neutral-300">Vídeos curtos — Operando na prática</label><button type="button" onClick={() => setPracticalDrafts(items => [...items, { title: '', description: '', file: null }])} className="text-amber-400 font-bold">+ Adicionar</button></div>
                {editingLesson?.practicalVideos?.map(video => <p key={video.id} className="text-[10px] text-emerald-400">Vídeo atual: {video.title}</p>)}
                {practicalDrafts.map((draft, index) => <div key={index} className="grid grid-cols-1 gap-2 border-t border-neutral-800 pt-2"><input value={draft.title} onChange={e => setPracticalDrafts(items => items.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="Título do vídeo prático" className="rounded-lg border border-neutral-800 bg-black px-2 py-2 text-neutral-100" /><input type="file" accept="video/mp4,.mp4" onChange={e => setPracticalDrafts(items => items.map((item, i) => i === index ? { ...item, file: e.target.files?.[0] || null } : item))} className="text-[10px] text-neutral-400" /><button type="button" onClick={() => setPracticalDrafts(items => items.filter((_, i) => i !== index))} className="text-left text-[10px] text-rose-400">Remover</button></div>)}
              </div>

              <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
                <div className="flex items-center justify-between"><label className="font-semibold text-neutral-300">Exercícios de imagem</label><button type="button" onClick={() => setImageDrafts(items => [...items, { title: '', description: '', original: null, corrected: null }])} className="text-amber-400 font-bold">+ Adicionar</button></div>
                {editingLesson?.imageExercises?.map(exercise => <p key={exercise.id} className="text-[10px] text-emerald-400">Exercício atual: {exercise.title}</p>)}
                {imageDrafts.map((draft, index) => <div key={index} className="grid grid-cols-1 gap-2 border-t border-neutral-800 pt-2"><input value={draft.title} onChange={e => setImageDrafts(items => items.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="Título do exercício" className="rounded-lg border border-neutral-800 bg-black px-2 py-2 text-neutral-100" /><label className="text-[10px] text-neutral-400">Imagem sem correção (obrigatória)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImageDrafts(items => items.map((item, i) => i === index ? { ...item, original: e.target.files?.[0] || null } : item))} className="block text-[10px]" /></label><label className="text-[10px] text-neutral-400">Imagem com correção (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImageDrafts(items => items.map((item, i) => i === index ? { ...item, corrected: e.target.files?.[0] || null } : item))} className="block text-[10px]" /></label><button type="button" onClick={() => setImageDrafts(items => items.filter((_, i) => i !== index))} className="text-left text-[10px] text-rose-400">Remover</button></div>)}
              </div>

              {lessonError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {lessonError}
                </div>
              )}

              {uploading && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-amber-400 font-semibold">
                    <span>{uploadStatus}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  {uploadBytes.total > 0 && <p className="text-[10px] text-neutral-500">{(uploadBytes.loaded / 1048576).toFixed(1)} MB de {(uploadBytes.total / 1048576).toFixed(1)} MB enviados</p>}
                </div>
              )}

              </div>
              <div className="flex shrink-0 gap-2 border-t border-neutral-800 bg-neutral-900 px-5 py-4 sm:px-7">
                <button
                  type="button"
                  onClick={() => { if (uploading) activeUploadRef.current?.abort(); else setLessonModalOpen(false); }}
                  className="flex-1 py-2.5 bg-neutral-800 text-neutral-300 rounded-xl font-semibold cursor-pointer"
                >
                  {uploading ? 'Cancelar envio' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 bg-amber-500 text-neutral-950 font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  {uploading ? 'Salvando...' : editingLessonId ? 'Atualizar Aula' : 'Salvar Aula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
