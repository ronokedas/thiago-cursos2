import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  RotateCcw, RotateCw, Settings, CheckCircle2, ShieldAlert, Sparkles 
} from 'lucide-react';
import { WatermarkData } from '../types';

interface VideoPlayerProps {
  streamUrl: string;
  lessonId: string;
  lessonTitle: string;
  durationSeconds: number;
  initialPositionSeconds: number;
  watermark: WatermarkData;
  isCompleted: boolean;
  onProgressUpdate?: (positionSeconds: number, durationSeconds: number, isCompleted: boolean) => void;
  onLessonCompleted?: () => void;
  onStreamError?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  streamUrl,
  lessonId,
  lessonTitle,
  durationSeconds,
  initialPositionSeconds,
  watermark,
  isCompleted,
  onProgressUpdate,
  onLessonCompleted,
  onStreamError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPositionSeconds || 0);
  const [duration, setDuration] = useState(durationSeconds || 600);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [completedState, setCompletedState] = useState(isCompleted);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const completedRef = useRef(completedState);
  const progressCallbackRef = useRef(onProgressUpdate);
  const completedCallbackRef = useRef(onLessonCompleted);
  const resumeAppliedRef = useRef<string | null>(null);
  const playRequestedRef = useRef(false);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { completedRef.current = completedState; }, [completedState]);
  useEffect(() => { progressCallbackRef.current = onProgressUpdate; }, [onProgressUpdate]);
  useEffect(() => { completedCallbackRef.current = onLessonCompleted; }, [onLessonCompleted]);

  // Dynamic watermark floating position
  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });

  // Periodically move watermark randomly across 6 safe zones to prevent cropping
  useEffect(() => {
    if (!watermark.enabled) return;

    const positions = [
      { top: '12%', left: '10%' },
      { top: '12%', left: '60%' },
      { top: '48%', left: '35%' },
      { top: '75%', left: '12%' },
      { top: '75%', left: '62%' },
      { top: '28%', left: '42%' },
    ];

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % positions.length;
      setWatermarkPos(positions[index]);
    }, (watermark.intervalSeconds || 15) * 1000);

    return () => clearInterval(interval);
  }, [watermark]);

  // The resume position must be applied once only. Progress saves update the
  // parent state every few seconds and must never seek playback backwards.
  useEffect(() => {
    resumeAppliedRef.current = null;
    setBufferedEnd(0);
    setStreamError(null);
  }, [lessonId, streamUrl]);

  useEffect(() => () => { if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current); }, []);

  const getBufferedAhead = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return 0;
    for (let index = 0; index < video.buffered.length; index++) {
      if (video.currentTime >= video.buffered.start(index) && video.currentTime <= video.buffered.end(index)) {
        return Math.max(0, video.buffered.end(index) - video.currentTime);
      }
    }
    return 0;
  }, []);

  const syncBuffer = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    let end = video.currentTime;
    for (let index = 0; index < video.buffered.length; index++) {
      if (video.currentTime >= video.buffered.start(index) && video.currentTime <= video.buffered.end(index)) end = video.buffered.end(index);
    }
    setBufferedEnd(end);
  }, []);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    playRequestedRef.current = false;
    if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
    bufferTimeoutRef.current = null;
    video.play().then(() => {
      setIsPlaying(true);
      setIsBuffering(false);
    }).catch(error => {
      setIsBuffering(false);
      console.log('Playback prevented:', error);
    });
  }, []);

  const requestPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const ahead = getBufferedAhead();
    if (ahead >= 8 || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback();
      return;
    }
    playRequestedRef.current = true;
    setIsBuffering(true);
    if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
    bufferTimeoutRef.current = setTimeout(() => {
      if (playRequestedRef.current) startPlayback();
    }, 5000);
  }, [getBufferedAhead, startPlayback]);

  const saveProgress = useCallback((forceCompleted?: boolean) => {
    const pos = Math.floor(videoRef.current?.currentTime ?? currentTimeRef.current);
    const dur = Math.floor(videoRef.current?.duration || durationRef.current || durationSeconds || 600);
    const reachedCompletion = forceCompleted ?? (dur > 0 && (pos / dur) * 100 >= 90);
    if (reachedCompletion && !completedRef.current) {
      completedRef.current = true;
      setCompletedState(true);
      completedCallbackRef.current?.();
    }
    progressCallbackRef.current?.(pos, dur, reachedCompletion || completedRef.current);
  }, [durationSeconds]);

  // Stable interval: state changes from timeupdate no longer reset the five-second save.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => saveProgress(), 5000);
    return () => clearInterval(interval);
  }, [isPlaying, saveProgress]);

  useEffect(() => () => saveProgress(), [saveProgress]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      saveProgress();
    } else {
      requestPlayback();
    }
  }, [isPlaying, saveProgress, requestPlayback]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = Math.floor(videoRef.current.currentTime);
    setCurrentTime(curr);

    const dur = Math.floor(videoRef.current.duration) || durationSeconds;
    if (dur && dur !== duration) {
      setDuration(dur);
    }

    if ((curr / dur) >= 0.9 && !completedRef.current) saveProgress(true);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const resumeKey = `${lessonId}:${streamUrl}`;
    if (resumeAppliedRef.current !== resumeKey) {
      resumeAppliedRef.current = resumeKey;
      const resumePosition = Math.max(0, Math.min(initialPositionSeconds || 0, Math.max(0, video.duration - 1)));
      if (resumePosition > 0) video.currentTime = resumePosition;
      setCurrentTime(resumePosition);
    }
    if (Number.isFinite(video.duration)) setDuration(Math.floor(video.duration));
    syncBuffer();
  };

  const handleBufferProgress = () => {
    syncBuffer();
    const video = videoRef.current;
    if (playRequestedRef.current && video && (getBufferedAhead() >= 8 || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA)) startPlayback();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setSpeedMenuOpen(false);
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setSpeedMenuOpen(false);
      }
    }, 3500);
    setControlsTimeout(timeout);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Player Container */}
      <div
        ref={containerRef}
        id="mecanica-video-player-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative aspect-video w-full bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 select-none group"
      >
        {/* HTML5 Video Element */}
        <video
          ref={videoRef}
          src={streamUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleBufferProgress}
          onCanPlay={handleBufferProgress}
          onWaiting={() => { if (isPlaying) setIsBuffering(true); }}
          onStalled={() => { if (isPlaying) setIsBuffering(true); }}
          onSeeking={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => {
            setIsPlaying(false);
            setCompletedState(true);
            saveProgress(true);
          }}
          onError={() => { setStreamError('Não foi possível carregar este vídeo.'); onStreamError?.(); }}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          preload="auto"
        />

        {isBuffering && !streamError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-950/45 pointer-events-none">
            <div className="rounded-xl border border-amber-500/30 bg-neutral-950/90 px-4 py-3 text-xs font-semibold text-amber-300 shadow-xl">Preparando vídeo…</div>
          </div>
        )}

        {streamError && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-neutral-950/95 p-6 text-center">
            <ShieldAlert className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold text-white">{streamError}</p>
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950">Tentar novamente</button>
          </div>
        )}

        {/* Dynamic Anti-Leak Floating Watermark */}
        {watermark.enabled && (
          <div
            className="absolute pointer-events-none transition-all duration-1000 ease-in-out z-20 rotate-6"
            style={{ top: watermarkPos.top, left: watermarkPos.left }}
          >
            <div className="bg-black/40 backdrop-blur-xs px-3.5 py-1.5 rounded-lg border border-white/10 shadow-lg text-left font-mono">
              <p className="text-xs font-bold tracking-wider text-white/80 drop-shadow-md">
                ACESSO EXCLUSIVO: {watermark.userName.toUpperCase()}
              </p>
              <p className="text-[10px] text-neutral-300/70">
                {watermark.userMaskedEmail} • ID: {watermark.accountId}
              </p>
              <p className="text-[9px] text-neutral-400/50">
                {watermark.cpf ? `CPF: ${watermark.cpf} • ` : ''}IP: {watermark.clientIp} • {watermark.timestamp}
              </p>
            </div>
          </div>
        )}

        {/* Big Center Play/Pause Overlay Button on click/hover */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            aria-label="Reproduzir vídeo"
            className="absolute inset-0 m-auto w-20 h-20 bg-amber-600 hover:bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 transition-all hover:scale-110 active:scale-95 z-30 cursor-pointer"
          >
            <Play className="w-9 h-9 fill-current ml-1" />
          </button>
        )}

        {/* Watermark Security Notice Badge on Top Right */}
        <div className="absolute top-4 right-4 z-10 opacity-70 hover:opacity-100 transition-opacity pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-neutral-900/90 text-amber-400 border border-amber-500/30 backdrop-blur-md shadow-sm">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            Transmissão Segura
          </span>
        </div>

        {/* Control Bar Overlay */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-5 transition-opacity duration-300 z-30 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Progress Scrubber */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative w-full h-2.5 flex items-center">
              <div className="absolute left-0 h-1.5 rounded-lg bg-neutral-500/70" style={{ width: `${Math.min(100, (bufferedEnd / Math.max(duration || 1, 1)) * 100)}%` }} />
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="relative z-10 w-full h-1.5 bg-neutral-700/70 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:h-2.5 transition-all"
            />
            </div>
          </div>

          <div className="flex items-center justify-between">
            {/* Left Controls: Play, Skip, Time */}
            <div className="flex items-center space-x-3">
              <button
                onClick={togglePlay}
                className="text-white hover:text-amber-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <button
                onClick={() => skipTime(-10)}
                className="text-neutral-300 hover:text-white p-1 rounded transition-colors"
                title="Voltar 10 segundos"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => skipTime(10)}
                className="text-neutral-300 hover:text-white p-1 rounded transition-colors"
                title="Avançar 10 segundos"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume */}
              <div className="flex items-center space-x-2 group/vol">
                <button
                  onClick={toggleMute}
                  className="text-neutral-300 hover:text-white p-1 transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Time Display */}
              <span className="text-xs font-mono text-neutral-300 ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls: Speed, Completion Badge, Fullscreen */}
            <div className="flex items-center space-x-3 relative">
              {/* Playback Speed Menu */}
              <div className="relative">
                <button
                  onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                  className="px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-xs font-bold text-neutral-200 hover:text-amber-400 transition-colors"
                >
                  {playbackRate}x
                </button>
                {speedMenuOpen && (
                  <div className="absolute bottom-9 right-0 bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 z-40 min-w-[70px]">
                    {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => changeSpeed(speed)}
                        className={`text-xs px-2 py-1 rounded text-left transition-colors ${
                          playbackRate === speed ? 'bg-amber-600 text-white font-bold' : 'text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="text-neutral-300 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Under Player Security & Progress Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 flex items-center justify-between bg-neutral-800/40 p-4 rounded-2xl border border-neutral-800 text-xs gap-3">
          <div className="flex items-center gap-2.5 text-neutral-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Acesso exclusivo de <strong className="text-white">{watermark.userName}</strong>. Gravador e compartilhamento rastreados.
            </span>
          </div>
          {completedState ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Concluída (100%)
            </span>
          ) : (
            <span className="text-neutral-400 shrink-0">
              Progresso: <span className="font-semibold text-amber-400">{Math.min(100, Math.round((currentTime / (duration || 1)) * 100))}%</span>
            </span>
          )}
        </div>

        <div className="bg-amber-600/10 p-4 rounded-2xl border border-amber-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-amber-300 font-medium">Marcador Automático</span>
          </div>
          <span className="text-[11px] text-amber-400/90 font-mono">Conclusão aos 90%</span>
        </div>
      </div>
    </div>
  );
};
