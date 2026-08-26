import React, { useState, useEffect } from 'react';
import { 
  Play, CheckCircle2, Lock, ChevronLeft, ChevronRight, 
  FileText, Download, ShieldCheck, Clock, BookOpen, AlertCircle, ArrowLeft, Image as ImageIcon, Video, Maximize, X
} from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';
import { LessonDetail, CourseSummary, ModuleSummary, WatermarkData } from '../types';

interface StudentLessonViewProps {
  lessonId: string;
  onSelectLesson: (id: string) => void;
  onBackToDashboard: () => void;
}

const CorrectedImageViewer: React.FC<{ image: { title: string; url: string }; onBack: () => void }> = ({ image, onBack }) => {
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const viewerRef = React.useRef<HTMLDivElement>(null);
  const toggleFullscreen = async () => { if (!document.fullscreenElement) { await viewerRef.current?.requestFullscreen(); setFullscreen(true); } else { await document.exitFullscreen(); setFullscreen(false); } };
  return <div ref={viewerRef} className="relative aspect-video overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
    <div className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between"><button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-lg bg-black/70 px-3 py-2 text-xs font-bold text-white"><X className="h-4 w-4" />Voltar ao vídeo</button><div className="flex gap-2"><button type="button" onClick={() => setZoom(value => Math.max(1, value - .25))} className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white">−</button><button type="button" onClick={() => setZoom(value => Math.min(3, value + .25))} className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white">+</button><button type="button" onClick={toggleFullscreen} className="rounded-lg bg-black/70 p-2 text-white"><Maximize className="h-4 w-4" /></button></div></div>
    <img src={image.url} alt={`Correção: ${image.title}`} draggable className="h-full w-full object-contain transition-transform duration-200" style={{ transform: `scale(${zoom})` }} />
    <div className="absolute bottom-3 left-3 rounded bg-black/65 px-3 py-2 text-xs text-neutral-200">{image.title} · visualização protegida</div>
  </div>;
};

export const StudentLessonView: React.FC<StudentLessonViewProps> = ({
  lessonId,
  onSelectLesson,
  onBackToDashboard,
}) => {
  const [lessonData, setLessonData] = useState<{
    lesson: LessonDetail;
    stream: { streamUrl: string; ticket: string; provider: string };
    watermark: WatermarkData;
    progress: { isCompleted: boolean; progressPercent: number; lastPositionSeconds: number; mainVideoEndedAt?: string | null };
    telegram?: { url: string; message: string; buttonLabel: string };
  } | null>(null);

  const [courseTree, setCourseTree] = useState<{ course: CourseSummary; modules: ModuleSummary[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessRestricted, setAccessRestricted] = useState<{
    daysRemaining?: number;
    availableAt?: string;
    reason?: string;
  } | null>(null);
  const [mediaTab, setMediaTab] = useState<'MAIN' | 'PRACTICAL' | 'IMAGES'>('MAIN');
  const [practicalStream, setPracticalStream] = useState<{ id: string; title: string; streamUrl: string; durationSeconds: number } | null>(null);
  const [correctedImage, setCorrectedImage] = useState<{ title: string; url: string } | null>(null);
  const [mediaMessage, setMediaMessage] = useState<string | null>(null);

  const fetchLesson = async (id: string) => {
    setLoading(true);
    setAccessRestricted(null);
    try {
      const [res, treeRes] = await Promise.all([
        fetch(`/api/student/lesson/${id}`),
        fetch('/api/student/course'),
      ]);

      if (res.ok) {
        const d = await res.json();
        setLessonData(d);
      } else if (res.status === 403) {
        const err = await res.json();
        setAccessRestricted(err.access || { reason: 'Bloqueado temporariamente.' });
      }

      if (treeRes.ok) {
        const tree = await treeRes.json();
        setCourseTree(tree);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLesson(lessonId);
    setMediaTab('MAIN'); setPracticalStream(null); setCorrectedImage(null); setMediaMessage(null);
  }, [lessonId]);

  const handleMainVideoEnded = async (positionSeconds: number, durationSeconds: number) => {
    try {
      const response = await fetch(`/api/student/lesson/${lessonId}/main-video-ended`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionSeconds, durationSeconds }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível liberar os conteúdos.');
      const result = await response.json();
      setLessonData(prev => prev ? { ...prev, progress: { ...prev.progress, mainVideoEndedAt: result.mainVideoEndedAt, isCompleted: true, progressPercent: 100 } } : prev);
      setMediaMessage('Vídeos práticos e correções foram liberados.');
    } catch (error) { setMediaMessage(error instanceof Error ? error.message : 'Falha ao liberar conteúdos.'); }
  };

  const selectPracticalVideo = async (video: NonNullable<typeof lessonData>['lesson']['practicalVideos'][number]) => {
    try {
      const response = await fetch(`/api/stream/ticket/${lessonId}/practical/${video.id}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Não foi possível abrir o vídeo prático.');
      setCorrectedImage(null); setPracticalStream({ id: video.id, title: video.title, streamUrl: data.streamUrl, durationSeconds: video.durationSeconds || 600 }); setMediaTab('PRACTICAL');
    } catch (error) { setMediaMessage(error instanceof Error ? error.message : 'Falha ao abrir vídeo.'); }
  };

  const handleProgressUpdate = async (pos: number, dur: number, completed: boolean, completionAction?: 'MARK_COMPLETE' | 'MARK_INCOMPLETE') => {
    try {
      const response = await fetch('/api/student/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          positionSeconds: pos,
          durationSeconds: dur,
          ...(completionAction ? { completionAction } : {}),
        }),
      });
      if (!response.ok) throw new Error('Não foi possível salvar o progresso.');
      setLessonData(prev => prev ? { ...prev, progress: { ...prev.progress, lastPositionSeconds: pos, progressPercent: Math.max(prev.progress.progressPercent, Math.round((pos / Math.max(dur, 1)) * 100)), isCompleted: completionAction === 'MARK_INCOMPLETE' ? false : (completed || prev.progress.isCompleted) } } : prev);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleManualComplete = async () => {
    if (!lessonData) return;
    const nextState = !lessonData.progress.isCompleted;
    setLessonData({
      ...lessonData,
      progress: { ...lessonData.progress, isCompleted: nextState },
    });
    handleProgressUpdate(
      lessonData.progress.lastPositionSeconds || 0,
      lessonData.lesson.durationSeconds || 600,
      nextState,
      nextState ? 'MARK_COMPLETE' : 'MARK_INCOMPLETE'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-neutral-400 font-mono">CARREGANDO STREAMING SEGURO...</p>
        </div>
      </div>
    );
  }

  // Access Restricted Screen (7-Day Rule)
  if (accessRestricted) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Conteúdo com Liberação Progressiva</h2>
          <p className="text-sm text-neutral-300 max-w-md mx-auto leading-relaxed">
            Esta aula faz parte dos módulos avançados da Mentoria e será liberada automaticamente após o período inicial de 7 dias de matrícula.
          </p>
        </div>

        {accessRestricted.daysRemaining && (
          <div className="inline-block bg-[#171717] border border-neutral-800 px-5 py-3 rounded-2xl">
            <p className="text-xs text-neutral-400">Tempo restante para liberação automática:</p>
            <p className="text-lg font-bold text-amber-400 mt-0.5">
              {accessRestricted.daysRemaining} {accessRestricted.daysRemaining === 1 ? 'dia' : 'dias'}
            </p>
          </div>
        )}

        <div className="pt-4 flex justify-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!lessonData) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-bold tracking-widest uppercase mb-1">
            <button onClick={onBackToDashboard} className="hover:underline flex items-center gap-1 font-semibold">
              <ChevronLeft className="w-3.5 h-3.5" />
              Início
            </button>
            <span>•</span>
            <span className="truncate max-w-[200px]">{lessonData.lesson.module.title}</span>
            <span>•</span>
            <span className="truncate max-w-[250px]">{lessonData.lesson.topic.title}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {lessonData.lesson.title}
          </h1>
        </div>

        {/* Action Toggle Completion */}
        <button
          onClick={handleToggleManualComplete}
          className={`self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            lessonData.progress.isCompleted
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{lessonData.progress.isCompleted ? 'Concluída ✓' : 'Marcar como Concluída'}</span>
        </button>
      </div>

      {/* Main Grid: Video Player + Curriculum Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Player & Lesson Info */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {([
                ['MAIN', 'Vídeo principal', Play], ['PRACTICAL', 'Operando na prática', Video], ['IMAGES', 'Imagens e correções', ImageIcon],
              ] as const).map(([tab, label, Icon]) => {
                const locked = tab !== 'MAIN' && !lessonData.progress.mainVideoEndedAt;
                return <button key={tab} type="button" onClick={() => { setMediaTab(tab); setMediaMessage(locked ? 'Finalize o vídeo principal para liberar este conteúdo.' : null); }} className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold ${mediaTab === tab ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'} ${locked ? 'opacity-70' : ''}`}><Icon className="h-4 w-4" />{locked && <Lock className="h-3.5 w-3.5" />}{label}</button>;
              })}
            </div>
            {mediaMessage && <p className="mt-2 px-2 text-xs text-amber-300">{mediaMessage}</p>}
          </section>

          {mediaTab === 'PRACTICAL' && <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">Operando na prática</h2>
            {!lessonData.progress.mainVideoEndedAt ? <p className="text-xs text-neutral-400">Finalize o vídeo principal para liberar os vídeos curtos.</p> : lessonData.lesson.practicalVideos?.length ? <div className="grid gap-2 sm:grid-cols-2">{lessonData.lesson.practicalVideos.map(video => <button type="button" key={video.id} onClick={() => selectPracticalVideo(video)} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-left hover:border-amber-500/50"><p className="text-xs font-bold text-neutral-100">{video.title}</p><p className="mt-1 text-[11px] text-neutral-500 line-clamp-2">{video.description || 'Vídeo complementar de operação.'}</p></button>)}</div> : <p className="text-xs text-neutral-500">Ainda não há vídeos práticos nesta aula.</p>}
          </section>}

          {mediaTab === 'IMAGES' && <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">Imagens e correções</h2>
            {lessonData.lesson.imageExercises?.length ? <div className="space-y-2">{lessonData.lesson.imageExercises.map(exercise => <div key={exercise.id} className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-neutral-100">{exercise.title}</p><p className="text-[11px] text-neutral-500">{exercise.description}</p></div><div className="flex gap-2"><a href={exercise.originalDownloadUrl} className="inline-flex items-center gap-1 rounded-lg bg-neutral-800 px-3 py-2 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5" />Sem correção</a>{exercise.hasCorrected && (lessonData.progress.mainVideoEndedAt && exercise.correctedViewUrl ? <button type="button" onClick={() => { setPracticalStream(null); setCorrectedImage({ title: exercise.title, url: exercise.correctedViewUrl! }); }} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-neutral-950"><ImageIcon className="h-3.5 w-3.5" />Ver correção</button> : <span className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-500"><Lock className="h-3.5 w-3.5" />Correção bloqueada</span>)}</div></div>)}</div> : <p className="text-xs text-neutral-500">Ainda não há exercícios de imagem nesta aula.</p>}
          </section>}

          {/* Custom Video Player with Floating Watermark */}
          {correctedImage ? <CorrectedImageViewer image={correctedImage} onBack={() => setCorrectedImage(null)} /> : practicalStream ? <VideoPlayer streamUrl={practicalStream.streamUrl} lessonId={`${lessonData.lesson.id}:${practicalStream.id}`} lessonTitle={practicalStream.title} durationSeconds={practicalStream.durationSeconds} initialPositionSeconds={0} watermark={lessonData.watermark} isCompleted={false} trackProgress={false} /> : lessonData.lesson.hasVideo === false ? <div className="aspect-video rounded-2xl border border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center gap-3 text-center p-6">
            <AlertCircle className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold text-white">Vídeo ainda não disponível</p>
            <p className="text-xs text-neutral-400">O administrador ainda precisa concluir o upload desta aula.</p>
          </div> : <VideoPlayer
            streamUrl={lessonData.stream.streamUrl}
            lessonId={lessonData.lesson.id}
            lessonTitle={lessonData.lesson.title}
            durationSeconds={lessonData.lesson.durationSeconds}
            initialPositionSeconds={lessonData.progress.lastPositionSeconds}
            watermark={lessonData.watermark}
            isCompleted={lessonData.progress.isCompleted}
            onProgressUpdate={handleProgressUpdate}
            onLessonCompleted={() => {
              setLessonData(prev => prev ? { ...prev, progress: { ...prev.progress, isCompleted: true } } : null);
            }}
            onMainVideoEnded={handleMainVideoEnded}
          />}

          {lessonData.telegram?.url && (
            <section className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 text-sm">
              <h2 className="font-bold text-sky-200">Dúvidas sobre esta aula?</h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-300">{lessonData.telegram.message}</p>
              <a href={lessonData.telegram.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-400">
                {lessonData.telegram.buttonLabel || 'Entrar no grupo do Telegram'}
              </a>
            </section>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between p-4 bg-neutral-800/40 rounded-2xl border border-neutral-800">
            <span className="text-xs text-neutral-400 font-medium">Navegação Entre Aulas</span>
            <div className="flex items-center gap-2">
              {lessonData.lesson.prevLesson && (
                <button
                  onClick={() => onSelectLesson(lessonData.lesson.prevLesson!.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Aula Anterior</span>
                </button>
              )}

              {lessonData.lesson.nextLesson && (
                <button
                  onClick={() => onSelectLesson(lessonData.lesson.nextLesson!.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <span>Próxima Aula</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Description & Security Box Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-neutral-800/40 p-5 rounded-2xl border border-neutral-800 space-y-2">
              <h3 className="text-sm font-bold text-neutral-300">Descrição da Aula</h3>
              <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-line">
                {lessonData.lesson.description || 'Assista à aula com atenção, anote os conceitos de leitura de fluxo institucional e aplique no seu plano diário de operações.'}
              </p>
            </div>

            <div className="bg-amber-600/10 p-5 rounded-2xl border border-amber-500/20 flex flex-col justify-center space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-amber-400 uppercase tracking-wide">Aviso de Segurança</span>
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Este conteúdo é exclusivo e individual. O compartilhamento ou gravação não autorizada resultará em bloqueio permanente e rastreio de IP.
              </p>
            </div>
          </div>

          {/* Supplementary Materials */}
          {lessonData.lesson.supplementaryMaterials?.length > 0 && (
            <div className="bg-neutral-800/40 p-6 rounded-2xl border border-neutral-800 space-y-4">
              <h2 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Materiais Complementares
              </h2>
              <div className="space-y-2">
                {lessonData.lesson.supplementaryMaterials.map(mat => (
                  <div
                    key={mat.id}
                    className="flex items-center justify-between p-3.5 bg-[#0A0A0A] rounded-xl border border-neutral-800 hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-neutral-200">{mat.title}</p>
                        <p className="text-[10px] text-neutral-500 uppercase font-mono">{mat.type}</p>
                      </div>
                    </div>
                    <a
                      href={mat.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Sleek Curriculum Sidebar */}
        <aside className="bg-[#101010] border border-neutral-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-5 border-b border-neutral-800">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">
              Conteúdo do Curso
            </h2>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-neutral-500">Progresso desta aula</span>
              <span className="text-amber-400 font-bold">
                {lessonData.progress.progressPercent || (lessonData.progress.isCompleted ? 100 : 0)}%
              </span>
            </div>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${lessonData.progress.progressPercent || (lessonData.progress.isCompleted ? 100 : 0)}%` }}
              />
            </div>
          </div>

          <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
            {courseTree?.modules.map(module => {
              const isAllowed = module.access.allowed;

              return (
                <div key={module.id} className="space-y-1.5">
                  <div className={`w-full flex items-center justify-between p-3 rounded-xl border text-left ${
                    isAllowed
                      ? 'bg-neutral-800/50 text-neutral-200 border-neutral-700/50'
                      : 'bg-neutral-800/30 text-neutral-500 border-neutral-800 opacity-60'
                  }`}>
                    <span className="font-semibold text-xs truncate mr-2">
                      {module.title.replace(new RegExp(`^Módulo\\s+${module.position}:\\s*`, 'i'), `Módulo ${module.position}: `)}
                    </span>
                    {!isAllowed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] bg-neutral-700 text-neutral-300 font-mono px-1.5 py-0.5 rounded">
                          {module.access.daysRemaining || 7} DIAS
                        </span>
                        <Lock className="w-3.5 h-3.5 text-neutral-400" />
                      </div>
                    )}
                  </div>

                  {/* Lessons in module */}
                  <div className="space-y-1 ml-2 pl-2 border-l border-neutral-800">
                    {module.topics.map(topic => (
                      <div key={topic.id} className="space-y-1">
                        {topic.lessons.map(les => {
                          const isCurrent = les.id === lessonId;
                          const isLesAllowed = les.access.allowed;

                          return (
                            <button
                              key={les.id}
                              disabled={!isLesAllowed}
                              onClick={() => onSelectLesson(les.id)}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20'
                                  : isLesAllowed
                                  ? 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                                  : 'text-neutral-500 opacity-60 italic cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate mr-2">
                                {les.isCompleted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                ) : isCurrent ? (
                                  <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                  </div>
                                ) : isLesAllowed ? (
                                  <Play className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                )}
                                <span className="truncate">{les.title}</span>
                              </div>

                              <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                                {Math.floor(les.durationSeconds / 60)} min
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
};
