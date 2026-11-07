import { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  Flame,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  Cloud,
  Download,
  Ellipsis,
  FolderOpen,
  Image,
  Layers,
  LayoutGrid,
  Maximize2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Type,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
  GripVertical,
  AlignCenter,
  AlignLeft,
  AlignRight,
  FileText,
  Save,
  Copy,
  Keyboard,
  LoaderCircle,
  MoveHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Project, Word } from './core/types';
import { readProject } from './core/validate';
import { createDemo } from './core/demo';
import { presets, animations } from './core/presets';
import { useAlignment } from './core/useAlignment';
import { useProject, savedProjects, downloadJson } from './core/storage';
const analyzeAudio = async (input: File | ArrayBuffer) =>
  (await import('./core/analysis')).analyzeAudio(input);
import { parseLyrics, lyricsFromWords, wordsToSrt } from './core/lyrics';
import { LyricVideo } from './video/Composition';
const stamp = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const precise = (s: number) => `${stamp(s)}:${String(Math.floor((s % 1) * 30)).padStart(2, '0')}`;
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const previewAsset = (url: string) => (API && url.startsWith('/uploads/') ? API + url : url);
async function request(path: string, options?: RequestInit) {
  const r = await fetch(API + path, options);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'The request failed.');
  return data;
}
async function upload(file: File) {
  const body = new FormData();
  body.append('file', file);
  return request('/api/upload', { method: 'POST', body });
}
function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={17} />
    </button>
  );
}
export default function App() {
  const { project, update, undo, redo, canUndo, canRedo } = useProject();
  const player = useRef<PlayerRef>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('Styles');
  const [frame, setFrame] = useState(38);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [snapping, setSnapping] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All styles');
  const [selectedScene, setSelectedScene] = useState(project.scenes[0]?.id || '');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [modal, setModal] = useState<'import' | 'export' | 'projects' | 'help' | null>(null);
  const [lyricsText, setLyricsText] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [resolution, setResolution] = useState('1080p');
  const [exportProject, setExportProject] = useState<Project | null>(null);
  const [renderJob, setRenderJob] = useState<{
    id: string;
    status: string;
    progress: number;
    url?: string;
    error?: string;
  } | null>(null);
  const [customTemplates, setCustomTemplates] = useState<
    { name: string; presetId: string; style: Project['style'] }[]
  >(() => {
    try {
      return JSON.parse(localStorage.getItem('lyricforge-templates') || '[]');
    } catch {
      return [];
    }
  });
  const previewProject = useMemo(
    () => ({
      ...project,
      audioUrl: previewAsset(project.audioUrl),
      style: {
        ...project.style,
        customFontUrl: project.style.customFontUrl
          ? previewAsset(project.style.customFontUrl)
          : undefined,
      },
      scenes: project.scenes.map((s) => ({
        ...s,
        background: s.background ? previewAsset(s.background) : undefined,
      })),
    }),
    [project],
  );
  const time = frame / 30;
  const scene = project.scenes.find((s) => s.id === selectedScene) || project.scenes[0];
  const activePreset = presets.find((p) => p.id === scene?.presetId) || presets[0];
  const word = project.words.find((w) => w.id === selectedWord);
  const lines = useMemo(
    () =>
      Array.from(new Set(project.words.map((w) => w.lineId))).map((id) =>
        project.words.filter((w) => w.lineId === id),
      ),
    [project.words],
  );
  const notify = (message: string) => setToast(message);
  const alignment = useAlignment(project, update, notify);
  const seek = (seconds: number) => {
    const f = Math.max(
      0,
      Math.min(Math.round(project.duration * 30) - 1, Math.round(seconds * 30)),
    );
    player.current?.seekTo(f);
    setFrame(f);
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const ref = player.current;
    if (!ref) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    ref.addEventListener('frameupdate', onFrame);
    ref.addEventListener('play', onPlay);
    ref.addEventListener('pause', onPause);
    ref.seekTo(38);
    return () => {
      ref.removeEventListener('frameupdate', onFrame);
      ref.removeEventListener('play', onPlay);
      ref.removeEventListener('pause', onPause);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setTab('Styles');
        setTimeout(
          () => document.querySelector<HTMLInputElement>('.search-field input')?.focus(),
          50,
        );
        return;
      }
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        player.current?.toggle();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (e.key === 'ArrowRight') seek(time + 0.1);
      if (e.key === 'ArrowLeft') seek(time - 0.1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [time, undo, redo, project.duration]);
  useEffect(() => {
    if (!renderJob || ['done', 'completed', 'failed', 'cancelled'].includes(renderJob.status))
      return;
    const t = setInterval(
      () =>
        request(`/api/render/${renderJob.id}`)
          .then(setRenderJob)
          .catch((e) => notify(e.message)),
      1000,
    );
    return () => clearInterval(t);
  }, [renderJob?.id, renderJob?.status]);
  useEffect(() => {
    if (project.analysis || !project.audioUrl) return;
    let cancelled = false;
    fetch(API + project.audioUrl)
      .then((r) => r.arrayBuffer())
      .then(analyzeAudio)
      .then((analysis) => {
        if (!cancelled) update((p) => ({ ...p, analysis }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [project.audioUrl]);
  const style = (change: Partial<Project['style']>) =>
    update((p) => ({ ...p, style: { ...p.style, ...change } }));
  const applyPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id)!;
    update((p) => ({
      ...p,
      style: { ...p.style, accent: preset.color },
      scenes: p.scenes.map((s) =>
        s.id === scene?.id
          ? {
              ...s,
              presetId: id,
              ...(id === 'cinematic'
                ? {
                    background: s.background || '/assets/cinematic.jpg',
                    backgroundType: s.backgroundType || 'image',
                  }
                : { background: undefined, backgroundType: undefined }),
            }
          : s,
      ),
    }));
  };
  const updateWord = (id: string, change: Partial<Word>) =>
    update((p) => ({
      ...p,
      words: p.words.map((w) => (w.id === id ? { ...w, ...change, source: 'manual' } : w)),
    }));
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy('Importing your files…');
    try {
      let next = { ...project };
      for (const file of Array.from(files).sort(
        (a, b) => Number(/\.(mp3|wav)$/i.test(b.name)) - Number(/\.(mp3|wav)$/i.test(a.name)),
      )) {
        if (/\.(mp3|wav)$/i.test(file.name)) {
          const [asset, analysis] = await Promise.all([upload(file), analyzeAudio(file)]);
          next = {
            ...next,
            id: project.id === 'demo' ? crypto.randomUUID() : next.id,
            audioUrl: asset.url,
            audioName: file.name,
            name: file.name.replace(/\.[^.]+$/, ''),
            duration: analysis.duration,
            analysis,
            words: [],
            scenes: [
              {
                ...project.scenes[0],
                id: crypto.randomUUID(),
                start: 0,
                end: analysis.duration,
                name: 'Scene 01',
              },
            ],
          };
        } else if (/\.(txt|lrc|srt)$/i.test(file.name)) {
          next = { ...next, words: parseLyrics(await file.text(), file.name, next.duration) };
        } else throw new Error('Choose an MP3, WAV, TXT, LRC, or SRT file.');
      }
      update(next);
      alignment.autoAlign(next);
      setSelectedScene(next.scenes[0].id);
      setModal(null);
      seek(0);
      notify(
        next.words.some((w) => w.source === 'estimated')
          ? 'Imported. Estimated word timings are ready for review.'
          : 'Your files are ready.',
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy('');
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  async function exportVideo() {
    setBusy('Starting render…');
    try {
      const job = await request('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, resolution }),
      });
      setRenderJob(job);
      setExportProject(project);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function background(file: File | undefined) {
    if (!file) return;
    setBusy('Uploading background…');
    try {
      const result = await upload(file);
      update((p) => ({
        ...p,
        scenes: p.scenes.map((s) =>
          s.id === scene?.id
            ? {
                ...s,
                background: result.url,
                backgroundType: file.type.startsWith('video') ? 'video' : 'image',
              }
            : s,
        ),
      }));
      notify('Background added to this scene.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function importFont(file: File | undefined) {
    if (!file) return;
    setBusy('Adding your font…');
    try {
      const result = await upload(file);
      style({ fontFamily: 'Custom font', customFontUrl: result.url });
      notify('Custom font added. Use a font you have permission to embed.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  function splitScene() {
    if (!scene || time <= scene.start + 0.1 || time >= scene.end - 0.1) {
      notify('Move the playhead inside the selected scene to split it.');
      return;
    }
    update((p) => ({
      ...p,
      scenes: p.scenes.flatMap((s) =>
        s.id === scene.id
          ? [
              { ...s, end: time },
              { ...s, id: crypto.randomUUID(), start: time, name: s.name + ' · B' },
            ]
          : [s],
      ),
    }));
  }
  function saveTemplate() {
    const name = prompt('Name your reusable style', `${activePreset.name} · My style`);
    if (!name) return;
    const next = [...customTemplates, { name, presetId: scene.presetId, style: project.style }];
    setCustomTemplates(next);
    localStorage.setItem('lyricforge-templates', JSON.stringify(next));
    notify('Template saved to your library.');
  }
  return (
    <div className="app-shell">
      <input
        ref={fontInput}
        type="file"
        accept=".woff,.woff2,.ttf,.otf"
        hidden
        onChange={(e) => importFont(e.target.files?.[0])}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".mp3,.wav,.txt,.lrc,.srt"
        multiple
        hidden
        onChange={(e) => importFiles(e.target.files)}
      />
      <input
        ref={bgInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        hidden
        onChange={(e) => background(e.target.files?.[0])}
      />
      <input
        ref={projectInput}
        type="file"
        accept=".json"
        hidden
        onChange={async (e) => {
          try {
            const p = readProject(JSON.parse(await e.target.files![0].text()));
            update(p);
            setModal(null);
            notify('Project opened.');
          } catch (error) {
            notify((error as Error).message);
          }
        }}
      />
      <header className="app-header">
        <button className="brand" onClick={() => setModal('projects')}>
          <span className="brand-mark">
            <Flame size={23} fill="currentColor" />
          </span>
          lyricforge<span className="beta">STUDIO</span>
        </button>
        <div className="header-divider" />
        <button className="project-breadcrumb" onClick={() => setModal('projects')}>
          My workspace <ChevronRight size={13} />
          <span>{project.name}</span>
          <ChevronDown size={13} />
        </button>
        <div className="header-right">
          <span className="saved-status">
            <Cloud size={15} /> All changes saved
          </span>
          <button className="avatar" onClick={() => setModal('projects')} title="My projects">
            JD
          </button>
          <button
            className="export-button"
            onClick={() => {
              setModal('export');
            }}
          >
            <Download size={15} />
            Export video
            <ChevronDown size={13} />
          </button>
        </div>
      </header>
      <nav className="rail">
        {(
          [
            { name: 'Styles', icon: Sparkles },
            { name: 'Media', icon: Image },
            { name: 'Lyrics', icon: Type },
            { name: 'Audio', icon: Music2 },
            { name: 'Effects', icon: Layers },
            { name: 'Settings', icon: Settings2 },
          ] as { name: string; icon: LucideIcon }[]
        ).map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={`rail-item ${tab === name ? 'selected' : ''}`}
            onClick={() => setTab(name)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
        <div className="rail-spacer" />
        <button className="rail-item" onClick={() => setModal('projects')}>
          <FolderOpen size={20} />
          <span>Projects</span>
        </button>
        <button className="rail-item" onClick={() => setModal('help')}>
          <Keyboard size={20} />
          <span>Help</span>
        </button>
        <div className="rail-foot">LF</div>
      </nav>
      <aside className="library">
        <div className="panel-title">
          <h2>{tab === 'Styles' ? 'Find your visual sound' : tab}</h2>
          <SlidersHorizontal size={16} />
        </div>
        {tab === 'Styles' && (
          <>
            <p className="panel-subtitle">A whole new way to see your music.</p>
            <div className="search-field">
              <Search size={15} />
              <input
                aria-label="Search styles"
                placeholder="Search styles…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span>⌘ K</span>
            </div>
            <div className="category-tabs">
              {['All styles', 'My templates'].map((c) => (
                <button
                  key={c}
                  className={category === c ? 'selected' : ''}
                  onClick={() => setCategory(c)}
                >
                  {c}
                  {c === 'My templates' && <span>{customTemplates.length}</span>}
                </button>
              ))}
            </div>
            {category === 'All styles' ? (
              <>
                <div className="section-label">
                  MADE FOR YOUR MUSIC <span>10 styles</span>
                </div>
                <div className="preset-grid">
                  {presets
                    .filter((p) =>
                      `${p.name} ${p.genre}`.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((p) => (
                      <button
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('preset', p.id)}
                        onClick={() => applyPreset(p.id)}
                        key={p.id}
                        className={`preset-card ${scene?.presetId === p.id ? 'chosen' : ''}`}
                      >
                        <div
                          className={`preset-art art-${p.id}`}
                          style={{ background: p.background }}
                        >
                          {p.id === 'cinematic' ? <img src="/assets/cinematic.jpg" /> : null}
                          <span className="preset-art-title">
                            {p.id === 'cinematic'
                              ? 'RISE'
                              : p.id === 'metal'
                                ? 'BURN'
                                : p.id === 'synthwave'
                                  ? 'AFTER HOURS'
                                  : p.id === 'acoustic'
                                    ? 'breathe'
                                    : p.name.toUpperCase()}
                          </span>
                          {scene?.presetId === p.id && (
                            <span className="preset-check">
                              <Check size={12} />
                            </span>
                          )}
                        </div>
                        <div className="preset-meta">
                          <strong>{p.name}</strong>
                          <span>{p.genre}</span>
                        </div>
                      </button>
                    ))}
                </div>
                <div className="library-note">
                  <span>
                    <Sparkles size={14} />
                  </span>
                  <div>
                    Your sound. Your signature.<small>Every style is yours to make your own.</small>
                  </div>
                </div>
              </>
            ) : (
              <div className="template-list">
                {customTemplates.length ? (
                  customTemplates.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        applyPreset(t.presetId);
                        style(t.style);
                      }}
                    >
                      <Layers size={20} />
                      <span>
                        {t.name}
                        <small>Custom template</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <Layers size={30} />
                    <h3>Make it your own</h3>
                    <p>Save your current look and reuse it with any song.</p>
                    <button className="secondary-button" onClick={saveTemplate}>
                      <Plus size={14} />
                      Save current style
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {tab === 'Media' && (
          <>
            <p className="panel-subtitle">Set the stage for your story.</p>
            <button
              className="upload-zone"
              onClick={() => bgInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                background(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={25} />
              <strong>Drop your media here</strong>
              <span>JPG, PNG, WEBP, MP4, WEBM</span>
              <em>Browse files</em>
            </button>
            <div className="section-label">PROJECT MEDIA</div>
            <button
              className="media-item"
              onClick={() =>
                update((p) => ({
                  ...p,
                  scenes: p.scenes.map((s) =>
                    s.id === scene?.id
                      ? { ...s, background: '/assets/cinematic.jpg', backgroundType: 'image' }
                      : s,
                  ),
                }))
              }
            >
              <img src="/assets/cinematic.jpg" />
              <span>
                Alpine light<small>Unsplash · free to use</small>
              </span>
              <Plus size={15} />
            </button>
            {scene?.background && (
              <button
                className="secondary-button wide"
                onClick={() =>
                  update((p) => ({
                    ...p,
                    scenes: p.scenes.map((s) =>
                      s.id === scene.id
                        ? { ...s, background: undefined, backgroundType: undefined }
                        : s,
                    ),
                  }))
                }
              >
                Use procedural background
              </button>
            )}
          </>
        )}
        {tab === 'Lyrics' && (
          <>
            <p className="panel-subtitle">Every word, right where it belongs.</p>
            <button
              className="secondary-button wide"
              onClick={() => {
                setLyricsText(lyricsFromWords(project.words));
                setModal('import');
              }}
            >
              <Plus size={15} />
              Import or paste lyrics
            </button>
            <button
              className="secondary-button wide"
              onClick={() => void alignment.align()}
              disabled={
                !alignment.status.available ||
                !!busy ||
                alignment.processing ||
                !project.audioUrl ||
                !project.words.length
              }
            >
              <WandSparkles size={15} />
              {alignment.status.available ? 'Align to vocals' : 'Alignment service unavailable'}
            </button>
            <div className="alignment-panel" data-testid="alignment-status">
              <div className="alignment-toggle">
                <span>
                  Auto-align new lyrics<small>English vocals · supplied lyrics only</small>
                </span>
                <button
                  role="switch"
                  aria-label="Automatically align imported lyrics"
                  aria-checked={alignment.autoEnabled}
                  className={`toggle ${alignment.autoEnabled ? 'on' : ''}`}
                  onClick={() => alignment.setAutoEnabled(!alignment.autoEnabled)}
                >
                  <i />
                </button>
              </div>
              <p>{alignment.status.provider}</p>
              {!alignment.status.available && (
                <>
                  <small>{alignment.status.reason}</small>
                  <button className="font-upload" onClick={() => void alignment.refresh()}>
                    Check connection
                  </button>
                </>
              )}
              {alignment.status.available && alignment.status.modelLoaded === false && (
                <small>
                  First alignment downloads the English model. It is cached for later songs.
                </small>
              )}
              {alignment.job && (
                <div className="alignment-job" role="status">
                  <strong>
                    {alignment.job.status === 'completed'
                      ? 'Vocal alignment complete'
                      : alignment.job.status === 'failed'
                        ? 'Alignment failed · timings kept'
                        : alignment.job.status === 'cancelled'
                          ? 'Alignment cancelled'
                          : alignment.job.status === 'discarded'
                            ? 'Newer edits preserved'
                            : alignment.job.status === 'queued'
                              ? 'Waiting for alignment…'
                              : 'Aligning words to vocals…'}
                  </strong>
                  {alignment.processing && (
                    <>
                      <progress max={100} value={alignment.job.progress ?? undefined} />
                      <button onClick={() => void alignment.cancel()}>Cancel alignment</button>
                    </>
                  )}
                  {alignment.job.error && <small>{alignment.job.error}</small>}
                </div>
              )}
            </div>
            <p className="small-note">
              {project.words.some((w) => w.source === 'estimated')
                ? 'Estimated timings need your review. Drag words or edit precise times.'
                : 'Authored or imported timing cues. Select any word to adjust it.'}
            </p>
            <div className="lyric-list">
              {lines.map((line, i) => (
                <div
                  className={`lyric-line ${time * 1000 >= line[0].startMs && time * 1000 < line[line.length - 1].endMs ? 'current' : ''}`}
                  key={line[0].lineId}
                >
                  <button className="line-number" onClick={() => seek(line[0].startMs / 1000)}>
                    {String(i + 1).padStart(2, '0')}
                  </button>
                  <div>
                    {line.map((w) => (
                      <button
                        key={w.id}
                        className={selectedWord === w.id ? 'selected' : ''}
                        onClick={() => {
                          setSelectedWord(w.id);
                          seek(w.startMs / 1000);
                        }}
                      >
                        {w.text}{' '}
                      </button>
                    ))}
                    <small>
                      {stamp(line[0].startMs / 1000)} — {stamp(line[line.length - 1].endMs / 1000)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === 'Audio' && (
          <>
            <p className="panel-subtitle">The heartbeat of your video.</p>
            <button className="upload-zone" onClick={() => fileInput.current?.click()}>
              <Music2 size={27} />
              <strong>Import your song</strong>
              <span>MP3 or WAV · up to 250 MB</span>
              <em>Choose audio</em>
            </button>
            <div className="audio-detail">
              <Music2 size={25} />
              <strong>{project.audioName}</strong>
              <span>
                {stamp(project.duration)} · {project.analysis?.bpm || '—'} BPM
              </span>
            </div>
            <div className="section-label">
              AUDIO ANALYSIS <span className="live-dot">●</span>
            </div>
            <div className="analysis-stats">
              <span>
                Detected beats<strong>{project.analysis?.beats.length ?? '—'}</strong>
              </span>
              <span>
                Transients<strong>{project.analysis?.transients.length ?? '—'}</strong>
              </span>
              <span>
                Intensity analysis<strong>{project.analysis ? 'Ready' : 'Processing'}</strong>
              </span>
            </div>
            <p className="small-note">
              Beats and intensity are analyzed from your audio. Enable beat reaction in the style
              settings.
            </p>
          </>
        )}
        {tab === 'Settings' && (
          <>
            <p className="panel-subtitle">Fine tune the details of your video.</p>
            <p className="small-note">
              Your typography, animation, color, and timing controls are in the style settings
              panel.
            </p>
          </>
        )}
        {tab === 'Effects' && (
          <>
            <p className="panel-subtitle">A little atmosphere. A lot of feeling.</p>
            <div className="effect-options">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={scene?.presetId === p.id ? 'selected' : ''}
                >
                  <span style={{ background: p.background }}>
                    <Sparkles size={20} />
                  </span>
                  <div>
                    {p.effect[0].toUpperCase() + p.effect.slice(1)}
                    <small>{p.genre} atmosphere</small>
                  </div>
                  {scene?.presetId === p.id ? <Check size={16} /> : <Plus size={16} />}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
      <main className="editor">
        <div className="workspace-bar">
          <div className="workspace-name">
            <span className="project-dot" />
            <input
              aria-label="Project name"
              value={project.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <ChevronDown size={13} />
          </div>
          <div className="workspace-actions">
            <button
              className="import-project"
              onClick={() => {
                setLyricsText('');
                setModal('import');
              }}
            >
              <Upload size={12} />
              Import
            </button>
            <IconButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
            <IconButton
              icon={Redo2}
              label="Redo (Ctrl+Shift+Z)"
              onClick={redo}
              disabled={!canRedo}
            />
            <div className="mini-divider" />
            <IconButton
              icon={MoreHorizontal}
              label="Project options"
              onClick={() => setModal('projects')}
            />
          </div>
        </div>
        <div
          className="preview-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('preset');
            if (id) applyPreset(id);
            else background(e.dataTransfer.files[0]);
          }}
        >
          <div className="preview-topline">
            <span>
              <span className="live-dot">●</span> LIVE PREVIEW
            </span>
            <button onClick={() => update({ aspect: project.aspect === '16:9' ? '9:16' : '16:9' })}>
              {project.aspect} <ChevronDown size={12} />
            </button>
          </div>
          <div className={`player-shell ${project.aspect === '9:16' ? 'vertical' : ''}`}>
            <Player
              ref={player}
              component={LyricVideo}
              inputProps={{ project: previewProject }}
              durationInFrames={Math.max(1, Math.ceil(project.duration * 30))}
              compositionWidth={project.aspect === '16:9' ? 1920 : 1080}
              compositionHeight={project.aspect === '16:9' ? 1080 : 1920}
              fps={30}
              style={{ width: '100%', height: '100%' }}
              acknowledgeRemotionLicense
              controls={false}
              clickToPlay={false}
              initiallyMuted={false}
              loop
              showVolumeControls={false}
              renderLoading={() => <div className="preview-loading">Preparing your canvas…</div>}
            />
            <div className="preview-corners">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="preview-bottomline">
            <span>
              <span className="preview-quality">HD</span> Scaled preview
            </span>
            <span>
              {project.aspect === '16:9' ? '1920 × 1080' : '1080 × 1920'}{' '}
              <span className="muted-text">·</span> 30 fps
            </span>
          </div>
        </div>
        <div className="transport">
          <div className="transport-left">
            <IconButton
              icon={muted ? VolumeX : Volume2}
              label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                muted ? player.current?.unmute() : player.current?.mute();
                setMuted(!muted);
              }}
            />
            <span className="volume-bars">▂▃▅▆</span>
          </div>
          <div className="transport-center">
            <IconButton
              icon={SkipBack}
              label="Previous scene"
              onClick={() =>
                seek([...project.scenes].reverse().find((s) => s.start < time - 0.2)?.start ?? 0)
              }
            />
            <button
              className="play-button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => player.current?.toggle()}
            >
              {playing ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>
            <IconButton
              icon={SkipForward}
              label="Next scene"
              onClick={() => seek(project.scenes.find((s) => s.start > time + 0.2)?.start ?? 0)}
            />
            <span className="timecode">
              {precise(time)} <span>/ {precise(project.duration)}</span>
            </span>
          </div>
          <div className="transport-right">
            <span className="keyboard-hint">space</span>
            <IconButton
              icon={Maximize2}
              label="Full screen preview"
              onClick={() => player.current?.requestFullscreen()}
            />
          </div>
        </div>
        <section className="timeline">
          <div className="timeline-toolbar">
            <div>
              <button className="tool-active" title="Select tool">
                <MousePointer2 size={15} />
              </button>
              <IconButton icon={Scissors} label="Split scene at playhead" onClick={splitScene} />
              <div className="mini-divider" />
              <button
                className="add-scene"
                onClick={() => {
                  const last = project.scenes[project.scenes.length - 1];
                  const midpoint = (last.start + last.end) / 2;
                  update((p) => ({
                    ...p,
                    scenes: [
                      ...p.scenes.slice(0, -1),
                      { ...last, end: midpoint },
                      {
                        ...last,
                        id: crypto.randomUUID(),
                        start: midpoint,
                        name: `Scene ${String(p.scenes.length + 1).padStart(2, '0')}`,
                      },
                    ],
                  }));
                }}
              >
                <Plus size={14} />
                Add scene
              </button>
            </div>
            <div>
              <button
                aria-label="Snap to beats"
                aria-pressed={snapping}
                className={`snap-label ${snapping ? 'enabled' : ''}`}
                onClick={() => setSnapping(!snapping)}
              >
                <MoveHorizontal size={13} /> Snap
              </button>
              <div className="mini-divider" />
              <IconButton
                icon={ZoomOut}
                label="Zoom out timeline"
                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              />
              <input
                aria-label="Timeline zoom"
                className="zoom-slider"
                type="range"
                min="1"
                max="6"
                step=".5"
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
              />
              <IconButton
                icon={ZoomIn}
                label="Zoom in timeline"
                onClick={() => setZoom((z) => Math.min(6, z + 0.5))}
              />
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
          <div className="timeline-body">
            <div className="track-labels">
              <div className="ruler-label">TRACKS</div>
              <div>
                <Image size={14} />
                <span>Scenes</span>
                <IconButton icon={Plus} label="Split current scene" onClick={splitScene} />
              </div>
              <div>
                <Music2 size={14} />
                <span>Audio</span>
                <button
                  title="Mute audio"
                  onClick={() => {
                    muted ? player.current?.unmute() : player.current?.mute();
                    setMuted(!muted);
                  }}
                >
                  {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
              </div>
              <div>
                <Type size={14} />
                <span>Lyrics</span>
                <button title="Edit lyrics" onClick={() => setTab('Lyrics')}>
                  <MoreHorizontal size={13} />
                </button>
              </div>
            </div>
            <div className="tracks-scroll">
              <div className="tracks-content" style={{ width: `${zoom * 100}%` }}>
                <div
                  className="time-ruler"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    seek(((e.clientX - r.left) / r.width) * project.duration);
                  }}
                >
                  {Array.from({ length: 13 }, (_, i) => (
                    <span key={i} style={{ left: `${(i / 12) * 100}%` }}>
                      {stamp((i / 12) * project.duration)}
                    </span>
                  ))}
                </div>
                <div className="scene-track">
                  {project.scenes.map((s, i) => (
                    <button
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('scene', s.id)}
                      className={`scene-clip ${selectedScene === s.id ? 'selected' : ''}`}
                      key={s.id}
                      style={{
                        left: `${(s.start / project.duration) * 100}%`,
                        width: `${((s.end - s.start) / project.duration) * 100}%`,
                        background: presets.find((p) => p.id === s.presetId)?.background,
                      }}
                      onClick={() => {
                        setSelectedScene(s.id);
                        seek(s.start + 0.2);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const sceneId = e.dataTransfer.getData('scene');
                        if (sceneId && sceneId !== s.id) {
                          e.preventDefault();
                          update((p) => {
                            const reordered = [...p.scenes];
                            const from = reordered.findIndex((sc) => sc.id === sceneId);
                            const to = reordered.findIndex((sc) => sc.id === s.id);
                            const moved = reordered.splice(from, 1)[0];
                            reordered.splice(to, 0, moved);
                            let cursor = 0;
                            return {
                              ...p,
                              scenes: reordered.map((sc) => {
                                const duration = sc.end - sc.start;
                                const updated = { ...sc, start: cursor, end: cursor + duration };
                                cursor += duration;
                                return updated;
                              }),
                            };
                          });
                          return;
                        }
                        const id = e.dataTransfer.getData('preset');
                        if (id) {
                          e.preventDefault();
                          update((p) => ({
                            ...p,
                            scenes: p.scenes.map((sc) =>
                              sc.id === s.id
                                ? {
                                    ...sc,
                                    presetId: id,
                                    background:
                                      id === 'cinematic' ? '/assets/cinematic.jpg' : undefined,
                                  }
                                : sc,
                            ),
                          }));
                        }
                      }}
                    >
                      {s.background && <img src={previewAsset(s.background)} />}
                      <span className="scene-number">{String(i + 1).padStart(2, '0')}</span>
                      <span>
                        {s.name}
                        <small>{presets.find((p) => p.id === s.presetId)?.name}</small>
                      </span>
                      <MoreHorizontal size={13} />
                    </button>
                  ))}
                </div>
                <div
                  className="wave-track"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    seek(((e.clientX - r.left) / r.width) * project.duration);
                  }}
                >
                  <span className="wave-name">
                    <Music2 size={10} />
                    {project.audioName}
                  </span>
                  <svg viewBox="0 0 1000 45" preserveAspectRatio="none">
                    {(project.analysis?.waveform || Array.from({ length: 800 }, () => 0.02)).map(
                      (v, i, a) => (
                        <line
                          key={i}
                          x1={(i / a.length) * 1000}
                          x2={(i / a.length) * 1000}
                          y1={24 - Math.max(1, v * 19)}
                          y2={24 + Math.max(1, v * 19)}
                          stroke="#a27bcb"
                          strokeWidth=".75"
                        />
                      ),
                    )}
                  </svg>
                  {project.analysis?.beats.map((b, i) => (
                    <i key={i} style={{ left: `${(b / project.duration) * 100}%` }} />
                  ))}
                </div>
                <div className="words-track">
                  {project.words.map((w) => (
                    <button
                      className={`word-clip ${selectedWord === w.id ? 'selected' : ''}`}
                      key={w.id}
                      style={{
                        left: `${(w.startMs / 1000 / project.duration) * 100}%`,
                        width: `${((w.endMs - w.startMs) / 1000 / project.duration) * 100}%`,
                      }}
                      title={`${w.text}: ${(w.startMs / 1000).toFixed(2)}–${(w.endMs / 1000).toFixed(2)}s · ${w.source}`}
                      onClick={() => {
                        setSelectedWord(w.id);
                        setTab('Lyrics');
                        seek(w.startMs / 1000);
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        const el = e.currentTarget;
                        const container = el.parentElement!;
                        const rect = container.getBoundingClientRect();
                        const x = e.clientX;
                        const isEnd = e.clientX > el.getBoundingClientRect().right - 6;
                        el.setPointerCapture(e.pointerId);
                        let delta = 0;
                        const move = (ev: PointerEvent) => {
                          delta = ((ev.clientX - x) / rect.width) * project.duration * 1000;
                          if (snapping && project.analysis?.beats.length) {
                            const proposed = (isEnd ? w.endMs : w.startMs) + delta;
                            const nearest = project.analysis.beats.reduce((a, b) =>
                              Math.abs(b * 1000 - proposed) < Math.abs(a * 1000 - proposed) ? b : a,
                            );
                            if (Math.abs(nearest * 1000 - proposed) < 80)
                              delta = nearest * 1000 - (isEnd ? w.endMs : w.startMs);
                          }
                          el.style.opacity = '.6';
                          el.style.transform = `translateX(${isEnd ? 0 : ev.clientX - x}px)`;
                        };
                        const up = () => {
                          el.removeEventListener('pointermove', move);
                          el.removeEventListener('pointerup', up);
                          el.style.opacity = '';
                          el.style.transform = '';
                          if (Math.abs(delta) > 20) {
                            if (isEnd)
                              updateWord(w.id, {
                                endMs: Math.min(
                                  project.duration * 1000,
                                  Math.max(w.startMs + 40, w.endMs + delta),
                                ),
                              });
                            else {
                              const start = Math.max(
                                0,
                                Math.min(
                                  project.duration * 1000 - (w.endMs - w.startMs),
                                  w.startMs + delta,
                                ),
                              );
                              updateWord(w.id, {
                                startMs: start,
                                endMs: start + w.endMs - w.startMs,
                              });
                            }
                          }
                        };
                        el.addEventListener('pointermove', move);
                        el.addEventListener('pointerup', up);
                      }}
                    >
                      {w.text}
                      <span />
                    </button>
                  ))}
                </div>
                <div className="playhead" style={{ left: `${(time / project.duration) * 100}%` }}>
                  <span />
                </div>
              </div>
            </div>
          </div>
          <footer className="timeline-footer">
            <span>
              <span className="status-dot" /> {project.scenes.length} scenes <i />{' '}
              {project.words.length} words <i /> {stamp(project.duration)} total
            </span>
            <button onClick={() => setModal('help')}>
              <Keyboard size={13} />
              Keyboard shortcuts
            </button>
          </footer>
        </section>
      </main>
      <aside className={`inspector ${tab === 'Settings' || selectedWord ? 'mobile-open' : ''}`}>
        <div className="inspector-heading">
          <h2>Style settings</h2>
          <IconButton icon={MoreHorizontal} label="Save style as template" onClick={saveTemplate} />
        </div>
        <div className="selected-style">
          <span
            className={`mini-art art-${activePreset.id}`}
            style={{ background: activePreset.background }}
          >
            <Flame size={22} />
          </span>
          <div>
            <strong>{activePreset.name}</strong>
            <small>{activePreset.genre}</small>
          </div>
          <span className="pill">APPLIED</span>
        </div>
        <div className="inspector-scroll">
          {word && (
            <div className="inspector-section timing-editor">
              <div className="control-section-title">
                <span>WORD TIMING</span>
                <button onClick={() => setSelectedWord(null)} title="Close word editor">
                  <X size={12} />
                </button>
              </div>
              <input
                aria-label="Selected word"
                value={word.text}
                onChange={(e) => updateWord(word.id, { text: e.target.value })}
              />
              <div className="two-columns">
                <label>
                  Start (s)
                  <input
                    aria-label="Word start time"
                    type="number"
                    min="0"
                    max={word.endMs / 1000 - 0.04}
                    step=".01"
                    value={+(word.startMs / 1000).toFixed(2)}
                    onChange={(e) => {
                      const v = +e.target.value * 1000;
                      if (v >= 0 && v < word.endMs) updateWord(word.id, { startMs: v });
                    }}
                  />
                </label>
                <label>
                  End (s)
                  <input
                    aria-label="Word end time"
                    type="number"
                    min={word.startMs / 1000 + 0.04}
                    max={project.duration}
                    step=".01"
                    value={+(word.endMs / 1000).toFixed(2)}
                    onChange={(e) => {
                      const v = +e.target.value * 1000;
                      if (v > word.startMs && v <= project.duration * 1000)
                        updateWord(word.id, { endMs: v });
                    }}
                  />
                </label>
              </div>
              <small>
                {word.source === 'estimated'
                  ? 'Estimated · review timing'
                  : `${word.source} timing`}
              </small>
              {word.source === 'aligned' && word.confidence !== null && (
                <small aria-label="Alignment confidence">
                  Model confidence: {Math.round(word.confidence * 100)}% · review timing
                </small>
              )}
            </div>
          )}
          <div className="inspector-section">
            <div className="control-section-title">
              <Type size={14} />
              <span>TYPOGRAPHY</span>
              <ChevronDown size={12} />
            </div>
            <label>
              Font family
              <select
                aria-label="Font family"
                value={project.style.fontFamily}
                onChange={(e) => style({ fontFamily: e.target.value })}
              >
                <option>Bebas Neue</option>
                <option>Inter</option>
                <option>Georgia</option>
                <option>monospace</option>
                {project.style.customFontUrl && <option>Custom font</option>}
              </select>
            </label>
            <button className="font-upload" onClick={() => fontInput.current?.click()}>
              <Upload size={11} />
              Upload font
            </button>
            <div className="two-columns">
              <label>
                Font size
                <div className="number-suffix">
                  <input
                    aria-label="Font size"
                    type="number"
                    min="12"
                    max="300"
                    value={project.style.fontSize}
                    onChange={(e) =>
                      style({ fontSize: Math.min(300, Math.max(12, +e.target.value)) })
                    }
                  />
                  <span>px</span>
                </div>
              </label>
              <label>
                Letter case
                <select
                  aria-label="Letter case"
                  value={project.style.textCase || 'uppercase'}
                  onChange={(e) =>
                    style({ textCase: e.target.value as 'uppercase' | 'lowercase' | 'none' })
                  }
                >
                  <option value="uppercase">Uppercase</option>
                  <option value="lowercase">Lowercase</option>
                  <option value="none">Original</option>
                </select>
              </label>
            </div>
          </div>
          <div className="inspector-section">
            <div className="control-section-title">
              <span className="color-icon" />
              <span>COLOR PALETTE</span>
              <ChevronDown size={12} />
            </div>
            <div className="color-row">
              <label>Text color</label>
              <div>
                <input
                  type="color"
                  aria-label="Text color"
                  value={project.style.color}
                  onChange={(e) => style({ color: e.target.value })}
                />
                <span>{project.style.color.toUpperCase()}</span>
              </div>
            </div>
            <div className="color-row">
              <label>Accent color</label>
              <div>
                <input
                  type="color"
                  aria-label="Accent color"
                  value={project.style.accent}
                  onChange={(e) => style({ accent: e.target.value })}
                />
                <span>{project.style.accent.toUpperCase()}</span>
              </div>
            </div>
            <div className="palette-swatches">
              {['#f17d4b', '#dfcba7', '#d2e66d', '#a69bff', '#e98cfa', '#b3caef', '#fff8ed'].map(
                (c) => (
                  <button
                    key={c}
                    aria-label={`Use accent ${c}`}
                    style={{ background: c }}
                    onClick={() => style({ accent: c })}
                    className={project.style.accent === c ? 'selected' : ''}
                  />
                ),
              )}
            </div>
          </div>
          <div className="inspector-section">
            <div className="control-section-title">
              <Sparkles size={14} />
              <span>ANIMATION</span>
              <ChevronDown size={12} />
            </div>
            <label>
              Text animation
              <select
                aria-label="Text animation"
                value={project.style.animation}
                onChange={(e) => style({ animation: e.target.value })}
              >
                {animations.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <div className="slider-label">
              <span>Atmosphere</span>
              <strong>{project.style.effects}%</strong>
            </div>
            <input
              aria-label="Atmosphere intensity"
              type="range"
              min="0"
              max="100"
              value={project.style.effects}
              onChange={(e) => style({ effects: +e.target.value })}
            />
            <div className="toggle-row">
              <span>
                <span className="orange-icon">ϟ</span> Beat reactive
                <small>Move with your music</small>
              </span>
              <button
                role="switch"
                aria-checked={project.style.beatReactive}
                aria-label="Beat reactive"
                className={`toggle ${project.style.beatReactive ? 'on' : ''}`}
                onClick={() => style({ beatReactive: !project.style.beatReactive })}
              >
                <i />
              </button>
            </div>
          </div>
          <div className="inspector-section">
            <div className="control-section-title">
              <Layers size={14} />
              <span>COMPOSITION</span>
              <ChevronDown size={12} />
            </div>
            <div className="two-columns">
              <label>
                Section
                <select
                  aria-label="Scene section"
                  value={scene?.section}
                  onChange={(e) =>
                    update((p) => ({
                      ...p,
                      scenes: p.scenes.map((s) =>
                        s.id === scene.id
                          ? { ...s, section: e.target.value as typeof s.section }
                          : s,
                      ),
                    }))
                  }
                >
                  <option value="verse">Verse</option>
                  <option value="chorus">Chorus</option>
                  <option value="bridge">Bridge</option>
                  <option value="breakdown">Breakdown</option>
                </select>
              </label>
              <label>
                Format
                <select
                  aria-label="Video format"
                  value={project.aspect}
                  onChange={(e) => update({ aspect: e.target.value as Project['aspect'] })}
                >
                  <option>16:9</option>
                  <option>9:16</option>
                </select>
              </label>
            </div>
            <label className="scene-name-field">
              Scene name
              <input
                aria-label="Scene name"
                value={scene?.name || ''}
                onChange={(e) =>
                  update((p) => ({
                    ...p,
                    scenes: p.scenes.map((sc) =>
                      sc.id === scene.id ? { ...sc, name: e.target.value } : sc,
                    ),
                  }))
                }
              />
            </label>
            <div className="two-columns">
              <label>
                Scene start (s)
                <input
                  aria-label="Scene start time"
                  type="number"
                  step=".1"
                  min="0"
                  max={scene?.end - 0.1}
                  value={+(scene?.start || 0).toFixed(2)}
                  disabled={project.scenes[0]?.id === scene?.id}
                  onChange={(e) => {
                    const v = +e.target.value;
                    const index = project.scenes.findIndex((sc) => sc.id === scene.id);
                    if (
                      index > 0 &&
                      v > project.scenes[index - 1].start + 0.1 &&
                      v < scene.end - 0.1
                    )
                      update((p) => ({
                        ...p,
                        scenes: p.scenes.map((sc, i) =>
                          i === index
                            ? { ...sc, start: v }
                            : i === index - 1
                              ? { ...sc, end: v }
                              : sc,
                        ),
                      }));
                  }}
                />
              </label>
              <label>
                Scene end (s)
                <input
                  aria-label="Scene end time"
                  type="number"
                  step=".1"
                  min={scene?.start + 0.1}
                  max={project.duration}
                  value={+(scene?.end || 0).toFixed(2)}
                  disabled={project.scenes.at(-1)?.id === scene?.id}
                  onChange={(e) => {
                    const v = +e.target.value;
                    const index = project.scenes.findIndex((sc) => sc.id === scene.id);
                    if (
                      index < project.scenes.length - 1 &&
                      v > scene.start + 0.1 &&
                      v < project.scenes[index + 1].end - 0.1
                    )
                      update((p) => ({
                        ...p,
                        scenes: p.scenes.map((sc, i) =>
                          i === index
                            ? { ...sc, end: v }
                            : i === index + 1
                              ? { ...sc, start: v }
                              : sc,
                        ),
                      }));
                  }}
                />
              </label>
            </div>
            <div className="slider-label">
              <span>Vertical position</span>
              <strong>{project.style.position}%</strong>
            </div>
            <input
              aria-label="Vertical position"
              type="range"
              min="10"
              max="90"
              value={project.style.position}
              onChange={(e) => style({ position: +e.target.value })}
            />
          </div>
        </div>
        <div className="inspector-footer">
          <button className="secondary-button wide" onClick={saveTemplate}>
            <Copy size={14} />
            Save as template
          </button>
          <span>Make this look your signature.</span>
        </div>
      </aside>
      {toast && (
        <div className="toast">
          <CheckCheck size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {alignment.processing && !busy && tab !== 'Lyrics' && (
        <button className="busy-indicator" onClick={() => setTab('Lyrics')}>
          <LoaderCircle className="spin" size={16} />
          Aligning vocal timings · View progress
        </button>
      )}
      {busy && (
        <div className="busy-indicator">
          <LoaderCircle className="spin" size={16} />
          {busy}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className={`modal ${modal === 'export' ? 'export-modal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </button>
            {modal === 'import' && (
              <>
                <div className="modal-symbol">
                  <Type size={24} />
                </div>
                <h2>Give your music a voice.</h2>
                <p>Import timestamped lyrics or paste your words below.</p>
                <button className="upload-zone" onClick={() => fileInput.current?.click()}>
                  <Upload size={24} />
                  <strong>Choose song or lyrics</strong>
                  <span>MP3, WAV, TXT, LRC, SRT · multiple files supported</span>
                </button>
                <textarea
                  aria-label="Paste lyrics"
                  placeholder="Paste your lyrics here…"
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  rows={7}
                />
                <p className="small-note">
                  Plain lyrics receive estimated timings. LRC and SRT preserve line timing; review
                  estimated word boundaries in the editor.
                </p>
                <button
                  className="export-button wide"
                  disabled={!lyricsText.trim()}
                  onClick={() => {
                    const next = {
                      ...project,
                      words: parseLyrics(lyricsText, 'lyrics.txt', project.duration),
                    };
                    update(next);
                    alignment.autoAlign(next);
                    setModal(null);
                    setTab('Lyrics');
                    notify('Lyrics added with estimated timings. Review and adjust each word.');
                  }}
                >
                  <WandSparkles size={15} />
                  Add lyrics to timeline
                </button>
              </>
            )}
            {modal === 'export' && (
              <>
                <div className="modal-symbol">
                  <Download size={24} />
                </div>
                <h2>Ready for the spotlight.</h2>
                <p>Your sound. Your vision. One beautiful video.</p>
                <div className="export-summary">
                  <span className="export-thumb">
                    <img src="/assets/cinematic.jpg" />
                    <Play size={18} />
                  </span>
                  <div>
                    <strong>{(exportProject ?? project).name}</strong>
                    <small>
                      {stamp((exportProject ?? project).duration)} ·{' '}
                      {(exportProject ?? project).aspect} · 30 fps
                    </small>
                  </div>
                </div>
                <label>
                  Resolution
                  <select
                    aria-label="Export resolution"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  >
                    <option value="720p">720p · quick preview</option>
                    <option value="1080p">1080p · Full HD</option>
                    <option value="4k">4K · Ultra HD</option>
                  </select>
                </label>
                <div className="export-details">
                  <span>
                    Format<strong>MP4 / H.264</strong>
                  </span>
                  <span>
                    Audio<strong>AAC · stereo</strong>
                  </span>
                  <span>
                    Rendering<strong>Dedicated server</strong>
                  </span>
                </div>
                {project.words.some((w) => w.source === 'estimated') && (
                  <p className="timing-notice">
                    Some word timings are estimated. Review them for accurate vocal synchronization.
                  </p>
                )}
                {renderJob && (
                  <div className="render-progress">
                    <div>
                      <strong>
                        {renderJob.status === 'completed' || renderJob.status === 'done'
                          ? 'Your video is ready'
                          : renderJob.status === 'failed'
                            ? 'Render failed'
                            : renderJob.status === 'cancelled'
                              ? 'Render cancelled'
                              : 'Bringing your video to life…'}
                      </strong>
                      <span>{Math.round(renderJob.progress)}%</span>
                    </div>
                    <progress value={renderJob.progress} max={100} />
                    {renderJob.error && <p>{renderJob.error}</p>}
                    {renderJob.url && (
                      <a className="export-button wide" href={API + renderJob.url} download>
                        <Download size={16} />
                        Download MP4
                      </a>
                    )}
                  </div>
                )}
                {!renderJob || ['failed', 'cancelled'].includes(renderJob.status) ? (
                  <button className="export-button wide" disabled={!!busy} onClick={exportVideo}>
                    <Download size={16} />
                    {busy || 'Export video'}
                    <ArrowUpRight size={16} />
                  </button>
                ) : (
                  !['done', 'completed'].includes(renderJob.status) && (
                    <button
                      className="secondary-button wide"
                      onClick={async () => {
                        const job = await request(`/api/render/${renderJob.id}`, {
                          method: 'DELETE',
                        });
                        setRenderJob(job);
                      }}
                    >
                      Cancel render
                    </button>
                  )
                )}
                {renderJob && ['done', 'completed'].includes(renderJob.status) && (
                  <button
                    className="secondary-button wide"
                    onClick={() => {
                      setRenderJob(null);
                      setExportProject(null);
                    }}
                  >
                    Export another version
                  </button>
                )}
                <span className="modal-footnote">Render in the background. Keep creating.</span>
              </>
            )}
            {modal === 'projects' && (
              <>
                <div className="modal-symbol">
                  <FolderOpen size={24} />
                </div>
                <h2>Your creative workspace.</h2>
                <p>Pick up where you left off, or start something new.</p>
                <div className="project-list">
                  {savedProjects().map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        update(p);
                        setSelectedScene(p.scenes[0]?.id);
                        setModal(null);
                        seek(0);
                      }}
                    >
                      <span>
                        <Music2 size={20} />
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {stamp(p.duration)} · {p.scenes.length} scenes
                        </small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                <div className="two-columns">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      const p = createDemo();
                      p.id = crypto.randomUUID();
                      p.name = 'Untitled project';
                      p.words = [];
                      p.audioUrl = '';
                      p.audioName = 'No audio imported';
                      p.analysis = null;
                      update(p);
                      setSelectedScene(p.scenes[0].id);
                      setModal(null);
                      fileInput.current?.click();
                    }}
                  >
                    <Plus size={15} />
                    New project
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => projectInput.current?.click()}
                  >
                    <FolderOpen size={15} />
                    Open JSON
                  </button>
                </div>
                <button
                  className="secondary-button wide"
                  onClick={() => downloadJson(project, `${project.name}.lyricforge.json`)}
                >
                  <Save size={15} />
                  Download project file
                </button>
                <button
                  className="secondary-button wide"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(
                      new Blob([wordsToSrt(project.words)], { type: 'text/plain' }),
                    );
                    a.download = project.name + '.srt';
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <FileText size={15} />
                  Download timed lyrics (SRT)
                </button>
              </>
            )}
            {modal === 'help' && (
              <>
                <div className="modal-symbol">
                  <Keyboard size={24} />
                </div>
                <h2>A little less clicking.</h2>
                <p>Stay in your creative flow.</p>
                <div className="shortcuts">
                  <span>
                    Play / pause<kbd>Space</kbd>
                  </span>
                  <span>
                    Undo<kbd>Ctrl / ⌘ Z</kbd>
                  </span>
                  <span>
                    Redo<kbd>Ctrl / ⌘ Shift Z</kbd>
                  </span>
                  <span>
                    Step backward / forward<kbd>← / →</kbd>
                  </span>
                </div>
                <p className="small-note">
                  Drop styles on a scene. Click a lyric to edit exact timing. Drag a word to move
                  it, or drag its right edge to change its duration. Projects save automatically in
                  this browser.
                </p>
                <button
                  className="export-button wide"
                  onClick={() => {
                    setModal(null);
                    setLyricsText('');
                    setModal('import');
                  }}
                >
                  <Upload size={16} />
                  Import your first song
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
