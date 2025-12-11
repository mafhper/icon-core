import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Download, Settings, Image as ImageIcon, Layers, Monitor, Smartphone, Globe, Info, Check, RefreshCw, X, AlertTriangle, Edit2, ZoomIn, Maximize, Moon, Sun, UploadCloud, Eye, LayoutTemplate, Grid, Palette, Sliders, ChevronRight, Minimize, Minus, Square, User, Languages, FileUp, Menu, Zap, ChevronLeft, ChevronDown, FolderOpen, HardDrive } from 'lucide-react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { ICON_DEFINITIONS, GeneratedFile, IconCategory, IconDefinition, EditOptions, IconVariant, AppLanguage, AppTheme, ImageAnalysis } from './types';
import { processImage, getDominantColor } from './utils/imageProcessor';
import { generateIco } from './utils/icoGenerator';
import { listenForApiRequests, sendApiResponse } from './utils/apiHelpers';

// --- Constants ---
const SUPPORTED_LANGUAGES: AppLanguage[] = ['pt', 'en', 'es', 'it', 'fr', 'de', 'zh', 'ja'];
const SUPPORTED_THEMES: AppTheme[] = ['light', 'dark', 'design'];
const PREVIEW_BACKGROUNDS = ['transparent', 'light', 'dark', 'brand', 'context'] as const;

// --- Translations ---
const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  pt: {
    appName: "ICON FORGE",
    appDesc: "Gerador Profissional de Ativos",
    mainSources: "Fontes",
    config: "Configuração",
    optimization: "Otimização",
    quality: "Qualidade / Compressão",
    estSize: "Tam. Estimado",
    primary: "Principal (>128px)",
    darkMode: "Modo Escuro (>128px)",
    smallSizes: "Tamanhos Pequenos",
    lightSmall: "Claro (<128px)",
    darkSmall: "Escuro (<128px)",
    brandColor: "Cor da Marca",
    preserveBg: "Preservar Fundo",
    preserveBgDesc: "Não preencher áreas transparentes.",
    generate: "Gerar Ativos",
    processing: "Processando...",
    ready: "Pronto para Gerar",
    readyDesc: "Envie seu logo principal para gerar ativos otimizados para Web, iOS, Android e Windows instantaneamente.",
    download: "Baixar Tudo",
    all: "Todos",
    web: "Web",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "Social",
    editor: "Editor e Análise",
    viewMode: "Modo de Visualização",
    fitScreen: "Ajustar à Tela",
    realSize: "Tamanho Real (1:1)",
    previewBg: "Fundo da Prévia",
    analysis: "Análise",
    goodVisibility: "Boa visibilidade detectada.",
    save: "Salvar",
    cancel: "Cancelar",
    settings: "Preferências",
    language: "Idioma",
    theme: "Tema",
    optional: "Opcional",
    upload: "Enviar",
    replace: "Substituir Arquivo",
    light: "Claro",
    dark: "Escuro",
    design: "Design",
    contrast: "Contraste",
    zoomHover: "Passe o mouse para ampliar",
    replaceSource: "Trocar Fonte desta Versão",
    detectedFail: "Falha de Contraste Detectada"
  },
  en: {
    appName: "ICON FORGE",
    appDesc: "Professional Asset Generator",
    mainSources: "Sources",
    config: "Configuration",
    optimization: "Optimization",
    quality: "Quality / Compression",
    estSize: "Est. Size",
    primary: "Primary (>128px)",
    darkMode: "Dark Mode (>128px)",
    smallSizes: "Small Sizes",
    lightSmall: "Light (<128px)",
    darkSmall: "Dark (<128px)",
    brandColor: "Brand Color",
    preserveBg: "Preserve Source Bg",
    preserveBgDesc: "Don't fill transparent areas.",
    generate: "Generate Assets",
    processing: "Processing...",
    ready: "Ready to Forge",
    readyDesc: "Upload your primary logo to generate optimized assets for Web, iOS, Android, and Windows instantly.",
    download: "Download All",
    all: "All",
    web: "Web",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "Social",
    editor: "Editor & Analysis",
    viewMode: "View Mode",
    fitScreen: "Fit Screen",
    realSize: "Real Size (1:1)",
    previewBg: "Preview Background",
    analysis: "Analysis",
    goodVisibility: "Good visibility detected.",
    save: "Save",
    cancel: "Cancel",
    settings: "Preferences",
    language: "Language",
    theme: "Theme",
    optional: "Optional",
    upload: "Upload",
    replace: "Replace",
    light: "Light",
    dark: "Dark",
    design: "Design",
    contrast: "Contrast",
    zoomHover: "Hover to magnify",
    replaceSource: "Replace Source File",
    detectedFail: "Contrast Failure Detected"
  },
  es: { 
    appName: "ICON FORGE", 
    appDesc: "Generador de Activos", 
    mainSources: "Fuentes", 
    config: "Configuración",
    optimization: "Optimización",
    quality: "Calidad / Compresión",
    estSize: "Tam. Est.",
    primary: "Principal", 
    darkMode: "Modo Oscuro", 
    smallSizes: "Tamaños Peq.", 
    lightSmall: "Claro", 
    darkSmall: "Oscuro", 
    brandColor: "Color Marca", 
    preserveBg: "Preservar Fondo", 
    preserveBgDesc: "No rellenar transparente", 
    generate: "Generar", 
    processing: "Procesando", 
    ready: "Listo", 
    readyDesc: "Sube tu logo.", 
    download: "Descargar", 
    all: "Todos", 
    web: "Web", 
    ios: "iOS", 
    pwa: "PWA", 
    windows: "Windows", 
    macos: "macOS", 
    linux: "Linux", 
    social: "Social", 
    editor: "Editor", 
    viewMode: "Vista", 
    fitScreen: "Ajustar", 
    realSize: "Real", 
    previewBg: "Fondo", 
    analysis: "Análisis", 
    goodVisibility: "Buena", 
    save: "Guardar", 
    cancel: "Cancelar", 
    settings: "Ajustes", 
    language: "Idioma", 
    theme: "Tema", 
    optional: "Opcional", 
    upload: "Subir", 
    replace: "Reemplazar", 
    light: "Claro", 
    dark: "Oscuro", 
    design: "Diseño", 
    contrast: "Contraste", 
    zoomHover: "Pasar mouse para ver", 
    replaceSource: "Reemplazar Archivo", 
    detectedFail: "Fallo de contraste" 
  },
  it: { 
    appName: "ICON FORGE", 
    appDesc: "Generatore Asset", 
    mainSources: "Fonti",
    config: "Configurazione", 
    optimization: "Ottimizzazione",
    quality: "Qualità",
    estSize: "Dim. Stima",
    primary: "Principale", 
    darkMode: "Scuro", 
    smallSizes: "Piccoli", 
    lightSmall: "Chiaro", 
    darkSmall: "Scuro", 
    brandColor: "Colore", 
    preserveBg: "Preserva Sfondo", 
    preserveBgDesc: "No riempimento", 
    generate: "Genera", 
    processing: "Attendere", 
    ready: "Pronto", 
    readyDesc: "Carica logo.", 
    download: "Scarica", 
    all: "Tutti", 
    web: "Web", 
    ios: "iOS", 
    pwa: "PWA", 
    windows: "Windows", 
    macos: "macOS", 
    linux: "Linux", 
    social: "Social", 
    editor: "Editor", 
    viewMode: "Vista", 
    fitScreen: "Adatta", 
    realSize: "Reale", 
    previewBg: "Sfondo", 
    analysis: "Analisi", 
    goodVisibility: "Ok", 
    save: "Salva", 
    cancel: "Annulla", 
    settings: "Impostazioni", 
    language: "Lingua", 
    theme: "Tema", 
    optional: "Opz.", 
    upload: "Carica", 
    replace: "Sostituisci", 
    light: "Chiaro", 
    dark: "Scuro", 
    design: "Design", 
    contrast: "Contrasto", 
    zoomHover: "Hover per zoom", 
    replaceSource: "Sostituisci File", 
    detectedFail: "Errore contrasto" 
  },
  fr: { 
    appName: "ICON FORGE", 
    appDesc: "Générateur", 
    mainSources: "Sources", 
    config: "Configuration",
    optimization: "Optimisation",
    quality: "Qualité",
    estSize: "Taille Est.",
    primary: "Principal", 
    darkMode: "Sombre", 
    smallSizes: "Petits", 
    lightSmall: "Clair", 
    darkSmall: "Sombre", 
    brandColor: "Couleur", 
    preserveBg: "Préserver Fond", 
    preserveBgDesc: "Pas de remplissage", 
    generate: "Générer", 
    processing: "Traitement", 
    ready: "Prêt", 
    readyDesc: "Chargez le logo.", 
    download: "Télécharger", 
    all: "Tous", 
    web: "Web", 
    ios: "iOS", 
    pwa: "PWA", 
    windows: "Windows", 
    macos: "macOS", 
    linux: "Linux", 
    social: "Social", 
    editor: "Éditeur", 
    viewMode: "Vue", 
    fitScreen: "Ajuster", 
    realSize: "Réel", 
    previewBg: "Fond", 
    analysis: "Analyse", 
    goodVisibility: "Ok", 
    save: "Sauver", 
    cancel: "Annuler", 
    settings: "Préférences", 
    language: "Langue", 
    theme: "Thème", 
    optional: "Opt.", 
    upload: "Upload", 
    replace: "Remplacer", 
    light: "Clair", 
    dark: "Sombre", 
    design: "Design", 
    contrast: "Contraste", 
    zoomHover: "Survoler pour zoomer", 
    replaceSource: "Remplacer Fichier", 
    detectedFail: "Échec du contraste" 
  },
  de: { 
    appName: "ICON FORGE", 
    appDesc: "Generator", 
    mainSources: "Quellen",
    config: "Konfiguration",
    optimization: "Optimierung",
    quality: "Qualität", 
    estSize: "Größe",
    primary: "Primär", 
    darkMode: "Dunkel", 
    smallSizes: "Klein", 
    lightSmall: "Hell", 
    darkSmall: "Dunkel", 
    brandColor: "Farbe", 
    preserveBg: "Hintergrund", 
    preserveBgDesc: "Kein Füllen", 
    generate: "Generieren", 
    processing: "Verarbeite", 
    ready: "Bereit", 
    readyDesc: "Logo hochladen.", 
    download: "Download", 
    all: "Alle", 
    web: "Web", 
    ios: "iOS", 
    pwa: "PWA", 
    windows: "Windows", 
    macos: "macOS", 
    linux: "Linux", 
    social: "Sozial", 
    editor: "Editor", 
    viewMode: "Ansicht", 
    fitScreen: "Passend", 
    realSize: "Echt", 
    previewBg: "Hintergrund", 
    analysis: "Analyse", 
    goodVisibility: "Ok", 
    save: "Speichern", 
    cancel: "Abbrechen", 
    settings: "Einstellungen", 
    language: "Sprache", 
    theme: "Thema", 
    optional: "Opt.", 
    upload: "Upload", 
    replace: "Ersetzen", 
    light: "Hell", 
    dark: "Dunkel", 
    design: "Design", 
    contrast: "Kontrast", 
    zoomHover: "Hover zum Zoomen", 
    replaceSource: "Datei Ersetzen", 
    detectedFail: "Kontrastfehler" 
  },
  zh: { 
    appName: "ICON FORGE", 
    appDesc: "生成器", 
    mainSources: "来源",
    config: "配置",
    optimization: "优化",
    quality: "质量", 
    estSize: "预计大小",
    primary: "主要", 
    darkMode: "深色", 
    smallSizes: "小", 
    lightSmall: "亮", 
    darkSmall: "深", 
    brandColor: "品牌色", 
    preserveBg: "保留背景", 
    preserveBgDesc: "不填充", 
    generate: "生成", 
    processing: "处理中", 
    ready: "就绪", 
    readyDesc: "上传图标", 
    download: "下载", 
    all: "全部", 
    web: "Web", 
    ios: "iOS", 
    pwa: "PWA", 
    windows: "Windows", 
    macos: "macOS", 
    linux: "Linux", 
    social: "社交", 
    editor: "编辑", 
    viewMode: "视图", 
    fitScreen: "适应", 
    realSize: "真实", 
    previewBg: "背景", 
    analysis: "分析", 
    goodVisibility: "良好", 
    save: "保存", 
    cancel: "取消", 
    settings: "设置", 
    language: "语言", 
    theme: "主题", 
    optional: "可选", 
    upload: "上传", 
    replace: "替换", 
    light: "亮", 
    dark: "深", 
    design: "设计", 
    contrast: "对比度", 
    zoomHover: "悬停放大", 
    replaceSource: "替换源文件", 
    detectedFail: "对比度失败" 
  },
  ja: { 
    appName: "ICON FORGE", 
    appDesc: "ジェネレーター", 
    mainSources: "ソース",
    config: "構成",
    optimization: "最適化",
    quality: "品質", 
    estSize: "サイズ",
    primary: "メイン", 
    darkMode: "ダーク", 
    smallSizes: "小", 
    lightSmall: "ライト", 
    darkSmall: "ダーク", 
    brandColor: "色", 
    preserveBg: "背景保持", 
    preserveBgDesc: "塗りつぶさない", 
    generate: "生成", 
    processing: "処理中", 
    ready: "準備完了", 
    readyDesc: "ロゴをアップロード", 
    download: "ダウンロード", 
    all: "すべて", 
    web: "Web", 
    ios: "iOS", 
    pwa: "PWA", 
    windows: "Windows", 
    macos: "macOS", 
    linux: "Linux", 
    social: "ソーシャル", 
    editor: "編集", 
    viewMode: "表示", 
    fitScreen: "合わせる", 
    realSize: "実寸", 
    previewBg: "背景", 
    analysis: "分析", 
    goodVisibility: "良好", 
    save: "保存", 
    cancel: "キャンセル", 
    settings: "設定", 
    language: "言語", 
    theme: "テーマ", 
    optional: "任意", 
    upload: "アップロード", 
    replace: "置換", 
    light: "ライト", 
    dark: "ダーク", 
    design: "デザイン", 
    contrast: "コントラスト", 
    zoomHover: "ホバーで拡大", 
    replaceSource: "ファイルを置換", 
    detectedFail: "コントラストエラー" 
  }
};

// --- Custom Logo ---
const Logo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-purple-500">
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// --- Components ---

const TitleBar = ({ onOpenSettings }: { onOpenSettings: () => void }) => (
  <div className="h-9 bg-black border-b border-border-subtle flex items-center justify-between select-none titlebar-drag-region w-full shrink-0 z-50 px-4 relative">
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted font-bold tracking-[0.2em] uppercase">Icon Forge</span>
    </div>
    <div className="flex items-center gap-1 no-drag">
      <button onClick={onOpenSettings} className="p-1.5 hover:bg-white/10 rounded-md text-text-muted hover:text-white transition-colors">
        <Settings size={14} />
      </button>
      <div className="w-px h-3 bg-white/10 mx-1"></div>
      <div className="flex gap-1">
        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
      </div>
    </div>
  </div>
);

const WcagBadge = ({ ratio }: { ratio?: number }) => {
  if (ratio === undefined || ratio === 0) return null;
  let color = "bg-red-500/20 text-red-400 border-red-500/30";
  let label = "FAIL";
  if (ratio >= 7) { color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; label = "AAA"; }
  else if (ratio >= 4.5) { color = "bg-green-500/20 text-green-400 border-green-500/30"; label = "AA"; }
  else if (ratio >= 3) { color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; label = "AA+"; }
  return (
    <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${color} flex items-center gap-1 shadow-sm`}>
      <span>WCAG</span><span className="opacity-80">{ratio.toFixed(2)}</span><span className="opacity-60 border-l border-current pl-1 ml-0.5">{label}</span>
    </div>
  );
};

const IconMagnifier = ({ url, bgClass }: { url: string, bgClass: string }) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPosition({ x, y });
  };

  return (
    <div 
      className="relative w-full h-full"
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      <div className={`w-full h-full flex items-center justify-center overflow-hidden border border-white/5 rounded-xl ${bgClass} cursor-crosshair`}>
         <img src={url} className="max-w-full max-h-full object-contain" alt="icon" />
      </div>
      
      {isHovering && (
        <div 
          className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-48 h-48 bg-bg-secondary border border-border-light rounded-2xl shadow-2xl z-50 overflow-hidden pointer-events-none animate-zoom-in"
        >
            <div className="absolute top-0 left-0 bg-black/80 text-white text-[9px] px-2 py-1 rounded-br-lg z-10 font-mono backdrop-blur-md flex items-center gap-2 border-b border-r border-white/10">
              <ZoomIn size={10} /> 400%
            </div>
            
            <div className={`w-full h-full overflow-hidden ${bgClass}`}>
               <img 
                 src={url} 
                 className="w-full h-full object-contain origin-center transition-transform duration-75 ease-out" 
                 style={{ 
                   transformOrigin: `${position.x}% ${position.y}%`,
                   transform: 'scale(4)',
                   imageRendering: 'pixelated'
                 }} 
                 alt="zoom" 
               />
            </div>
            
            {/* Crosshair overlay for precision feel */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <div className="w-4 h-0.5 bg-white/50 rounded-full"></div>
                <div className="h-4 w-0.5 bg-white/50 rounded-full absolute"></div>
            </div>
        </div>
      )}
    </div>
  );
};

const ContrastVisualizer = ({ analysis, tLabel }: { analysis: ImageAnalysis, tLabel: string }) => {
  if (!analysis.isLowContrast) return null;
  return (
    <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
       <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-red-400 uppercase"><AlertTriangle size={12} /> {tLabel}</div>
       <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex flex-col gap-1 items-center">
             <div className="w-8 h-8 rounded border border-border-subtle shadow-sm" style={{backgroundColor: analysis.detectedForegroundColor}}></div>
             <span className="font-mono text-[10px] text-text-secondary">{analysis.detectedForegroundColor}</span>
          </div>
          <div className="flex flex-col gap-1 items-center px-2">
             <span className="font-bold text-red-400 text-lg">{analysis.contrastRatio.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1 items-center">
             <div className="w-8 h-8 rounded border border-border-subtle shadow-sm" style={{backgroundColor: analysis.detectedBackgroundColor}}></div>
             <span className="font-mono text-[10px] text-text-secondary">{analysis.detectedBackgroundColor}</span>
          </div>
       </div>
    </div>
  );
};

const AccordionItem = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = false,
  collapsed = false 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children?: React.ReactNode; 
  defaultOpen?: boolean;
  collapsed?: boolean;
}) => {
  return (
    <details className="group border border-border-subtle bg-bg-tertiary/20 rounded-xl overflow-hidden mb-3" open={defaultOpen}>
      <summary className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wider">
          {icon}
          {!collapsed && <span>{title}</span>}
        </div>
        <ChevronDown size={14} className="text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className={`p-3 border-t border-border-subtle ${collapsed ? 'hidden' : 'block'}`}>
        {children}
      </div>
    </details>
  );
};

const App: React.FC = () => {
  const [lang, setLang] = useState<AppLanguage>('pt'); 
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('if-theme') as AppTheme;
    if (savedTheme) setTheme(savedTheme);
    const savedLang = localStorage.getItem('if-lang') as AppLanguage;
    if (savedLang) setLang(savedLang);
    else {
      const browserLang = navigator.language.split('-')[0] as AppLanguage;
      if (SUPPORTED_LANGUAGES.includes(browserLang)) setLang(browserLang);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('if-theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem('if-lang', lang); }, [lang]);

  const t = (key: string) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;

  // --- Global State ---
  const [file, setFile] = useState<File | null>(null);
  const [darkFile, setDarkFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [darkPreviewUrl, setDarkPreviewUrl] = useState<string | null>(null);
  const [smallFile, setSmallFile] = useState<File | null>(null);
  const [smallDarkFile, setSmallDarkFile] = useState<File | null>(null);
  const [smallPreviewUrl, setSmallPreviewUrl] = useState<string | null>(null);
  const [smallDarkPreviewUrl, setSmallDarkPreviewUrl] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcons, setGeneratedIcons] = useState<GeneratedFile[]>([]);
  const [activeTab, setActiveTab] = useState<IconCategory | 'all'>('all');
  
  const [brandColor, setBrandColor] = useState('#ffffff');
  const [keepOriginalBackground, setKeepOriginalBackground] = useState(false);
  const [dashboardPreviewBg, setDashboardPreviewBg] = useState<'checkered' | 'white' | 'black'>('checkered');
  const [compressionQuality, setCompressionQuality] = useState(0.9);

  const [editingIcon, setEditingIcon] = useState<GeneratedFile | null>(null);
  const [editOptions, setEditOptions] = useState<EditOptions>({ scale: 1, padding: 0, backgroundColor: '' });
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [editAnalysis, setEditAnalysis] = useState<ImageAnalysis | null>(null);
  const [modalPreviewBg, setModalPreviewBg] = useState<'transparent' | 'light' | 'dark' | 'brand' | 'context'>('transparent');
  const [modalViewMode, setModalViewMode] = useState<'fit' | 'actual'>('fit');

  const mainInputRef = useRef<HTMLInputElement>(null);
  const overrideInputRef = useRef<HTMLInputElement>(null);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);

  const groupedDefinitions = useMemo(() => {
    const groups: Record<string, IconDefinition[]> = {};
    for (const def of ICON_DEFINITIONS) {
      if (!groups[def.category]) groups[def.category] = [];
      groups[def.category].push(def);
    }
    return groups;
  }, []);

  const renderModalPreviewBackground = () => {
    let className = "absolute inset-0 z-0 ";
    let style: React.CSSProperties = {};
    switch (modalPreviewBg) {
        case 'transparent': className += "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-800"; break;
        case 'light': className += "bg-white"; break;
        case 'dark': className += "bg-black"; break;
        case 'brand': style.backgroundColor = brandColor; break;
        case 'context': className += "bg-gradient-to-br from-blue-500 to-purple-600"; break;
    }
    return <div className={className} style={style}></div>;
  };

  useEffect(() => {
    const cleanup = listenForApiRequests(async (data) => {
        try {
            const res = await fetch(data.image);
            const blob = await res.blob();
            const apiFile = new File([blob], "api_upload.png", { type: 'image/png' });
            const apiBrandColor = data.config?.brandColor || '#ffffff';
            const generated: {name: string, blob: Blob}[] = [];
            for (const def of ICON_DEFINITIONS) {
                const { blob: outBlob } = await processImage(apiFile, def, apiBrandColor, { scale: 1, padding: 0 });
                generated.push({ name: def.name, blob: outBlob });
            }
            const zip = new JSZip();
            generated.forEach(f => zip.file(f.name, f.blob));
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                sendApiResponse({ zip: base64data }, data.requestId);
            };
            reader.readAsDataURL(zipBlob);
        } catch (e) { console.error("API Error", e); }
    });
    return cleanup;
  }, []);

  type UploadType = 'main' | 'dark' | 'small' | 'small-dark';
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: UploadType) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('image/')) { alert('Please upload an image file.'); return; }
      const url = URL.createObjectURL(selectedFile);
      switch (type) {
        case 'main':
          setFile(selectedFile); setPreviewUrl(url);
          const img = new Image();
          img.onload = () => { setBrandColor(getDominantColor(img)); };
          img.src = url;
          setGeneratedIcons([]);
          break;
        case 'dark': setDarkFile(selectedFile); setDarkPreviewUrl(url); break;
        case 'small': setSmallFile(selectedFile); setSmallPreviewUrl(url); break;
        case 'small-dark': setSmallDarkFile(selectedFile); setSmallDarkPreviewUrl(url); break;
      }
    }
  };

  const clearFile = (type: UploadType) => {
    switch (type) {
      case 'main': setFile(null); setPreviewUrl(null); setGeneratedIcons([]); break;
      case 'dark': setDarkFile(null); setDarkPreviewUrl(null); break;
      case 'small': setSmallFile(null); setSmallPreviewUrl(null); break;
      case 'small-dark': setSmallDarkFile(null); setSmallDarkPreviewUrl(null); break;
    }
  };

  const generateSet = async (mainSource: File, smallSource: File | null, variant: IconVariant): Promise<GeneratedFile[]> => {
    const results: GeneratedFile[] = [];
    for (const def of ICON_DEFINITIONS) {
      let fileName = def.name;
      if (variant === 'dark') {
        const parts = def.name.split('.');
        const ext = parts.pop();
        fileName = `${parts.join('.')}-dark.${ext}`;
      }
      let sourceToUse = mainSource;
      if (def.width > 0 && def.width < 128 && smallSource) sourceToUse = smallSource;
      const { blob, analysis, size } = await processImage(sourceToUse, def, brandColor, { scale: 1, padding: 0, keepOriginalBackground, quality: compressionQuality });
      results.push({ id: `${variant}-${def.name}`, name: fileName, blob, url: URL.createObjectURL(blob), size, category: def.category, variant, width: def.width, height: def.height, originalDef: def, analysis });
    }
    const icoSizes = [16, 32, 48, 64];
    const icoBlobs: { width: number, height: number, blob: Blob }[] = [];
    const icoSource = smallSource || mainSource;
    for (const size of icoSizes) {
      const tempConfig: IconDefinition = { name: `temp-${size}`, width: size, height: size, category: 'web', transparent: true, format: 'png' };
      const { blob } = await processImage(icoSource, tempConfig, brandColor, { scale: 1, padding: 0, keepOriginalBackground, quality: compressionQuality });
      icoBlobs.push({ width: size, height: size, blob });
    }
    const icoBlob = await generateIco(icoBlobs);
    const icoUrl = URL.createObjectURL(icoBlob);
    const icoName = variant === 'dark' ? 'favicon-dark.ico' : 'favicon.ico';
    results.unshift({ id: `${variant}-favicon.ico`, name: icoName, blob: icoBlob, url: icoUrl, size: icoBlob.size, category: 'web', variant: variant, width: 32, height: 32, originalDef: { name: icoName, width: 32, height: 32, category: 'web', transparent: true, format: 'ico', label: 'Legacy Favicon (ICO)' } });

    const svgSource = (smallSource && smallSource.type === 'image/svg+xml') ? smallSource : mainSource;
    if (svgSource.type === 'image/svg+xml') {
       const sourceName = variant === 'dark' ? 'logo-dark.svg' : 'logo.svg';
       results.push({ id: `${variant}-source-svg`, name: sourceName, blob: svgSource, url: URL.createObjectURL(svgSource), size: svgSource.size, category: 'web', variant: variant, width: 0, height: 0, originalDef: { name: sourceName, width: 0, height: 0, category: 'web', transparent: true, format: 'png', label: 'Source Vector (SVG)' } });
       const svgName = variant === 'dark' ? 'favicon-dark.svg' : 'favicon.svg';
       results.push({ id: `${variant}-favicon.svg`, name: svgName, blob: svgSource, url: URL.createObjectURL(svgSource), size: svgSource.size, category: 'web', variant: variant, width: 0, height: 0, originalDef: { name: svgName, width: 0, height: 0, category: 'web', transparent: true, format: 'png', label: 'Modern Favicon (SVG)' } });
    }
    return results;
  };

  const handleGenerate = async () => {
    if (!file) return;
    setIsGenerating(true);
    setSidebarOpen(false); // Close mobile drawer
    try {
      const lightSet = await generateSet(file, smallFile, 'light');
      let finalSet = [...lightSet];
      if (darkFile) {
        const darkSet = await generateSet(darkFile, smallDarkFile, 'dark');
        finalSet = [...finalSet, ...darkSet];
      }
      setGeneratedIcons(finalSet);
    } catch (error) { console.error(error); alert("Error generating icons"); } finally { setIsGenerating(false); }
  };

  const handleDownload = async () => {
    if (generatedIcons.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("icon-forge-assets");
    generatedIcons.forEach(icon => folder?.file(icon.name, icon.blob));
    if (file && file.type === 'image/svg+xml' && !generatedIcons.find(i => i.name === 'logo.svg')) folder?.file('logo.svg', file);
    const pwaIcons = generatedIcons.filter(i => i.category === 'pwa' && i.variant === 'light');
    const manifestContent = { name: "My App", short_name: "App", start_url: "/", display: "standalone", background_color: brandColor, theme_color: brandColor, icons: pwaIcons.map(i => ({ src: i.name, sizes: `${i.width}x${i.height}`, type: "image/png", purpose: i.originalDef.maskable ? 'maskable' : 'any' })) };
    folder?.file("manifest.json", JSON.stringify(manifestContent, null, 2));
    const content = await zip.generateAsync({ type: "blob" });
    FileSaver.saveAs(content, "icon-forge-assets.zip");
  };

  const handleOverrideClick = (id: string) => { setOverrideTargetId(id); overrideInputRef.current?.click(); };
  const handleOverrideFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && overrideTargetId) {
      const newFile = e.target.files[0];
      const targetIconIndex = generatedIcons.findIndex(i => i.id === overrideTargetId);
      if (targetIconIndex === -1) return;
      const targetIcon = generatedIcons[targetIconIndex];
      try {
        const { blob, analysis, size } = await processImage(newFile, targetIcon.originalDef, brandColor, { scale: 1, padding: 0, keepOriginalBackground: true, quality: compressionQuality });
        const newUrl = URL.createObjectURL(blob);
        const updatedIcons = [...generatedIcons];
        updatedIcons[targetIconIndex] = { ...targetIcon, blob, url: newUrl, analysis, size };
        setGeneratedIcons(updatedIcons);
        if (editingIcon && editingIcon.id === overrideTargetId) { setEditingIcon(updatedIcons[targetIconIndex]); setEditPreviewUrl(newUrl); setEditAnalysis(analysis); }
      } catch (err) { alert("Failed replacement."); }
    }
    if (overrideInputRef.current) overrideInputRef.current.value = '';
  };

  useEffect(() => {
    let isCancelled = false;
    const updatePreview = async () => {
      let sourceFile = file;
      if (editingIcon?.variant === 'dark') sourceFile = darkFile || file;
      const isSmall = editingIcon ? editingIcon.width < 128 && editingIcon.width > 0 : false;
      if (isSmall) { if (editingIcon?.variant === 'dark' && smallDarkFile) sourceFile = smallDarkFile; else if (editingIcon?.variant === 'light' && smallFile) sourceFile = smallFile; }
      if (!editingIcon || !sourceFile) return;
      try {
        const { blob, analysis } = await processImage(sourceFile, editingIcon.originalDef, brandColor, editOptions);
        if (!isCancelled) { if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl); setEditPreviewUrl(URL.createObjectURL(blob)); setEditAnalysis(analysis); }
      } catch (e) { console.error(e); }
    };
    const timer = setTimeout(updatePreview, 50); 
    return () => { isCancelled = true; clearTimeout(timer); };
  }, [editOptions, editingIcon?.id]);

  const saveEditedIcon = async () => {
      if(!editingIcon || !editPreviewUrl || !editAnalysis) return;
      const res = await fetch(editPreviewUrl);
      const blob = await res.blob();
      setGeneratedIcons(prev => prev.map(icon => { if (icon.id === editingIcon.id) { return { ...icon, blob, url: editPreviewUrl, analysis: editAnalysis, size: blob.size }; } return icon; }));
      setEditingIcon(null);
  };

  const getDashboardBgClass = () => {
    if (dashboardPreviewBg === 'white') return 'bg-white';
    if (dashboardPreviewBg === 'black') return 'bg-black';
    return "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-900";
  };

  const categories: { id: IconCategory | 'all', labelKey: string, icon: React.ReactNode }[] = [
    { id: 'all', labelKey: 'all', icon: <Layers size={14} /> },
    { id: 'web', labelKey: 'web', icon: <Globe size={14} /> },
    { id: 'ios', labelKey: 'ios', icon: <Smartphone size={14} /> },
    { id: 'pwa', labelKey: 'pwa', icon: <Zap size={14} /> },
    { id: 'windows', labelKey: 'windows', icon: <Monitor size={14} /> },
    { id: 'macos', labelKey: 'macos', icon: <Monitor size={14} /> },
    { id: 'linux', labelKey: 'linux', icon: <Monitor size={14} /> },
    { id: 'social', labelKey: 'social', icon: <ImageIcon size={14} /> },
  ];

  const UploadZone = ({ file, preview, type, label, icon, height = "h-32", optional = false, inputRef }: { file: File | null, preview: string | null, type: UploadType, label: string, icon: React.ReactNode, height?: string, optional?: boolean, inputRef?: React.RefObject<HTMLInputElement> }) => (
    <div className="no-drag group relative hover:scale-[1.02] transition-transform duration-200">
      <label className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2 flex items-center gap-2">
        {icon} <span className="text-text-secondary">{label}</span> {optional && <span className="text-[10px] font-bold text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded ml-auto border border-border-subtle">{t('optional')}</span>}
      </label>
      {!file ? (
        <label className={`flex flex-col items-center justify-center ${height} border border-dashed border-border-light rounded-2xl bg-bg-tertiary/30 hover:bg-bg-tertiary hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all cursor-pointer overflow-hidden`}>
          <div className="p-3 rounded-full bg-bg-glass mb-2 group-hover:scale-110 transition-transform">
             <Upload className="w-5 h-5 text-text-muted group-hover:text-white" />
          </div>
          <span className="text-[10px] font-medium text-text-muted group-hover:text-text-secondary transition-colors">{t('upload')}</span>
          <input type="file" ref={inputRef} className="hidden" onChange={(e) => handleFileChange(e, type)} />
        </label>
      ) : (
        <div className={`relative ${height} border border-border-light rounded-2xl bg-black overflow-hidden group`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          <img src={preview!} className="relative z-10 w-full h-full object-contain p-4" alt={label} />
          <button onClick={() => clearFile(type)} className="absolute top-2 right-2 p-1.5 bg-black/80 backdrop-blur text-white rounded-full hover:bg-red-500 hover:text-white transition-colors border border-white/10 z-20"><X size={10}/></button>
        </div>
      )}
    </div>
  );

  const SidebarContent = () => (
    <div className={`flex-1 overflow-y-auto overflow-x-hidden ${sidebarCollapsed ? 'px-2 py-4' : 'px-6 py-4'}`}>
      
      {/* Uploads */}
      {!sidebarCollapsed ? (
        <AccordionItem title={t('mainSources')} icon={<FolderOpen size={14} className="text-purple-400" />} defaultOpen collapsed={sidebarCollapsed}>
             <div className="space-y-4">
               <UploadZone file={file} preview={previewUrl} type="main" label={t('primary')} icon={<Sun size={14} className="text-amber-400" />} inputRef={mainInputRef} />
               <UploadZone file={darkFile} preview={darkPreviewUrl} type="dark" label={t('darkMode')} icon={<Moon size={14} className="text-purple-400" />} optional height="h-24" />
               <div className="grid grid-cols-2 gap-3">
                 <UploadZone file={smallFile} preview={smallPreviewUrl} type="small" label={t('lightSmall')} icon={<Minimize size={14} className="text-text-muted" />} optional height="h-24" />
                 <UploadZone file={smallDarkFile} preview={smallDarkPreviewUrl} type="small-dark" label={t('darkSmall')} icon={<Minimize size={14} className="text-text-muted" />} optional height="h-24" />
               </div>
             </div>
        </AccordionItem>
      ) : (
        <div className="flex flex-col gap-4 items-center">
             <button onClick={() => setSidebarCollapsed(false)} className="p-3 bg-bg-tertiary rounded-xl hover:bg-purple-500/20 text-text-muted hover:text-white transition-colors" title={t('mainSources')}><FolderOpen size={18}/></button>
        </div>
      )}

      {/* Configuration */}
      {!sidebarCollapsed ? (
        <AccordionItem title={t('config')} icon={<Sliders size={14} className="text-blue-400" />} collapsed={sidebarCollapsed}>
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-subtle uppercase tracking-wider">{t('brandColor')}</label>
                <div className="flex gap-2 items-center">
                    <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-6 h-6 bg-transparent border-0 cursor-pointer rounded-full overflow-hidden" />
                    <input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="bg-bg-tertiary border border-border-light text-xs rounded-md px-2 py-1 w-20 font-mono text-text-secondary focus:outline-none focus:border-purple-500/50" />
                </div>
              </div>
              <label className="flex items-start gap-3 p-3 rounded-xl bg-bg-tertiary/20 border border-border-subtle cursor-pointer hover:bg-bg-tertiary/50 transition-colors">
                <input type="checkbox" checked={keepOriginalBackground} onChange={(e) => setKeepOriginalBackground(e.target.checked)} className="mt-0.5 accent-purple-500" />
                <div>
                    <span className="block text-sm font-medium text-text-secondary">{t('preserveBg')}</span>
                    <span className="block text-xs text-text-muted mt-0.5">{t('preserveBgDesc')}</span>
                </div>
              </label>
           </div>
        </AccordionItem>
      ) : null}

      {/* Optimization */}
      {!sidebarCollapsed ? (
        <AccordionItem title={t('optimization')} icon={<HardDrive size={14} className="text-green-400" />} collapsed={sidebarCollapsed}>
           <div className="space-y-4">
              <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-text-subtle uppercase tracking-wider">{t('quality')}</label>
                    <span className="text-xs font-mono text-text-secondary">{Math.round(compressionQuality * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05" 
                    value={compressionQuality} 
                    onChange={(e) => setCompressionQuality(parseFloat(e.target.value))} 
                    className="w-full accent-green-500 h-1.5 bg-bg-tertiary rounded-lg appearance-none cursor-pointer" 
                  />
                  <p className="text-[10px] text-text-muted mt-2">Adjusts JPEG/WebP quality. PNG files are lossless but will be processed.</p>
              </div>
           </div>
        </AccordionItem>
      ) : null}
      
    </div>
  );

  return (
    <div className="h-screen bg-bg-primary text-text-primary font-sans flex flex-col overflow-hidden relative selection:bg-purple-500/30 selection:text-white">
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none opacity-40"></div>
      
      <TitleBar onOpenSettings={() => setShowSettings(true)} />

      {/* --- HEADER --- */}
      <header className="h-16 border-b border-border-subtle bg-bg-glass backdrop-blur-md flex items-center justify-between px-4 md:px-8 shrink-0 no-drag z-30">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-text-muted hover:text-white">
                <Menu size={20} />
            </button>
            
            {/* Categories Scroll */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar mask-gradient-right max-w-[200px] sm:max-w-md lg:max-w-xl">
                {categories.map(cat => (
                    <button key={cat.id} onClick={() => setActiveTab(cat.id)} className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === cat.id ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-text-muted hover:text-white hover:bg-white/5'}`}>
                        {cat.icon} {t(cat.labelKey)}
                    </button>
                ))}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden md:flex items-center bg-bg-tertiary p-1 rounded-lg border border-border-light">
                  <button onClick={() => setDashboardPreviewBg('checkered')} className={`p-1.5 rounded-md transition-all ${dashboardPreviewBg === 'checkered' ? 'bg-bg-secondary text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'}`} title="Checkered"><Grid size={14}/></button>
                  <button onClick={() => setDashboardPreviewBg('white')} className={`p-1.5 rounded-md transition-all ${dashboardPreviewBg === 'white' ? 'bg-bg-secondary text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'}`} title="White"><div className="w-3.5 h-3.5 bg-white rounded-sm border border-gray-200"></div></button>
                  <button onClick={() => setDashboardPreviewBg('black')} className={`p-1.5 rounded-md transition-all ${dashboardPreviewBg === 'black' ? 'bg-bg-secondary text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'}`} title="Black"><div className="w-3.5 h-3.5 bg-black rounded-sm border border-gray-700"></div></button>
              </div>
              
              <button 
                  onClick={handleDownload}
                  disabled={generatedIcons.length === 0}
                  className={`px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 ${generatedIcons.length === 0 ? 'bg-bg-tertiary text-text-muted' : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]'}`}
              >
                  <Download size={16}/> <span className="hidden sm:inline">{t('download')}</span>
              </button>
          </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10">
        <input type="file" ref={overrideInputRef} hidden accept="image/*" onChange={handleOverrideFileChange} />

        {/* --- RESPONSIVE SIDEBAR / DRAWER --- */}
        {(sidebarOpen || window.innerWidth >= 768) && (
                 <aside 
                    className={`fixed md:static inset-y-0 left-0 z-40 bg-bg-glass backdrop-blur-xl border-r border-border-subtle flex flex-col shrink-0 animate-slide-in-left ${!sidebarOpen && 'hidden md:flex'} ${sidebarCollapsed ? 'w-20' : 'w-80 lg:w-96'} transition-[width] duration-300`}
                 >
                    <div className="p-4 md:hidden flex justify-between items-center border-b border-border-subtle">
                         <span className="font-bold text-white">{t('appName')}</span>
                         <button onClick={() => setSidebarOpen(false)}><X size={20} className="text-text-muted"/></button>
                    </div>

                    {/* Desktop Logo in Sidebar */}
                    <div className="hidden md:flex items-center justify-center py-6 shrink-0 border-b border-border-subtle/50">
                        <div className={`transition-all duration-300 ${sidebarCollapsed ? 'scale-100' : 'scale-125'}`}>
                            <div className="p-2.5 bg-bg-tertiary rounded-2xl border border-white/5 shadow-xl shadow-purple-500/5 group hover:scale-110 transition-transform cursor-default">
                                <Logo />
                            </div>
                        </div>
                    </div>
                    
                    <SidebarContent />

                    <div className="p-4 border-t border-border-subtle flex justify-end no-drag bg-bg-tertiary/20">
                         <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                           {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                         </button>
                    </div>

                    <div className={`p-6 bg-gradient-to-t from-bg-primary via-bg-primary/90 to-transparent sticky bottom-0 no-drag ${sidebarCollapsed ? 'px-2' : ''}`}>
                        <button 
                        onClick={handleGenerate}
                        disabled={!file || isGenerating}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${!file ? 'bg-bg-tertiary text-text-muted cursor-not-allowed' : 'bg-gradient-primary text-white shadow-[0_0_40px_-10px_rgba(168,85,247,0.4)] hover:shadow-[0_0_60px_-10px_rgba(168,85,247,0.6)]'}`}
                        >
                        {isGenerating ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
                        {!sidebarCollapsed && (isGenerating ? t('processing') : t('generate'))}
                        </button>
                    </div>
                 </aside>
        )}
        
        {/* Backdrop for mobile drawer */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>}

        {/* --- MAIN DASHBOARD --- */}
        <main className="flex-1 flex flex-col min-w-0 bg-bg-secondary/30 relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 no-drag relative">
              {generatedIcons.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-text-muted animate-fade-in-up">
                      <div onClick={() => mainInputRef.current?.click()} className="cursor-pointer w-40 h-40 rounded-[2.5rem] bg-bg-tertiary border border-border-light flex items-center justify-center mb-8 shadow-2xl shadow-purple-500/10 relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
                          <div className="transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                              <ImageIcon size={64} className="opacity-20 text-white" />
                          </div>
                          <div className="absolute bottom-4 text-[10px] font-bold uppercase tracking-widest text-text-muted group-hover:text-white transition-colors">Click Upload</div>
                      </div>
                      <h3 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight text-center">{t('ready')}</h3>
                      <p className="max-w-md text-center text-text-secondary leading-relaxed mb-8 text-sm md:text-base">{t('readyDesc')}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50">
                          {['Web', 'iOS', 'Android', 'Windows'].map(p => (
                              <div key={p} className="px-4 py-2 border border-border-subtle rounded-lg text-xs font-mono text-center">{p}</div>
                          ))}
                      </div>
                  </div>
              ) : (
                  <div className="max-w-7xl mx-auto space-y-12 pb-24">
                      {Object.entries(groupedDefinitions).map(([category, defs]) => {
                          if (activeTab !== 'all' && activeTab !== category) return null;
                          return (
                              <div 
                                key={category} className="mb-12 animate-fade-in"
                              >
                                  <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-6 flex items-center gap-3 pl-1">
                                      {t(category)}
                                      <div className="h-px bg-border-light flex-1"></div>
                                  </h2>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                                      {(defs as IconDefinition[]).map((def, idx) => {
                                          const lightIcon = generatedIcons.find(i => i.originalDef.name === def.name && i.variant === 'light');
                                          const darkIcon = generatedIcons.find(i => i.originalDef.name === def.name && i.variant === 'dark');
                                          if (!lightIcon) return null;

                                          return (
                                              <div 
                                                key={def.name} 
                                                className="bg-bg-glass backdrop-blur-md border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 group relative overflow-hidden animate-fade-in-up"
                                                style={{ animationDelay: `${idx * 0.05}s` }}
                                              >
                                                  {/* Header Info */}
                                                  <div className="flex justify-between items-start">
                                                      <div>
                                                          <h3 className="font-bold text-text-primary text-sm truncate max-w-[150px]" title={def.label || def.name}>{def.label || def.name}</h3>
                                                          <p className="text-[10px] text-text-muted font-mono mt-1 opacity-70">{def.width > 0 ? `${def.width}x${def.height}` : 'Vector'}</p>
                                                      </div>
                                                      <span className="text-[9px] bg-bg-tertiary px-1.5 py-0.5 rounded text-text-secondary border border-border-subtle uppercase font-bold">{def.format}</span>
                                                  </div>

                                                  {/* Icons Display - Grid within Card */}
                                                  <div className="grid grid-cols-2 gap-3 flex-1">
                                                      {/* Light Variant */}
                                                      <div className="relative border border-border-subtle bg-black rounded-2xl p-2 flex flex-col items-center justify-center aspect-square group/card transition-all hover:border-white/20">
                                                          <div className="absolute top-2 left-2 text-[9px] text-text-muted uppercase font-bold z-10 opacity-50"><Sun size={10}/></div>
                                                          <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                                                            <WcagBadge ratio={lightIcon.analysis?.contrastRatio} />
                                                            <span className="text-[9px] font-mono text-text-muted bg-bg-primary/80 px-1 rounded">{Math.round(lightIcon.size / 1024 * 10) / 10}KB</span>
                                                          </div>
                                                          <div className={`w-full h-full p-2 rounded-xl ${getDashboardBgClass()}`}>
                                                              {lightIcon.url && <IconMagnifier url={lightIcon.url} bgClass={getDashboardBgClass()} />}
                                                          </div>
                                                          {/* Hover Actions */}
                                                          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity z-30">
                                                              {lightIcon.width > 0 && <button onClick={() => { setEditingIcon(lightIcon); setEditOptions({scale:1, padding:0, backgroundColor: (lightIcon.originalDef.transparent || keepOriginalBackground) ? '' : brandColor, keepOriginalBackground}); }} className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-purple-600 hover:text-white shadow-lg"><Edit2 size={12}/></button>}
                                                              <button onClick={() => handleOverrideClick(lightIcon.id)} className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-purple-600 hover:text-white shadow-lg"><UploadCloud size={12}/></button>
                                                          </div>
                                                      </div>

                                                      {/* Dark Variant */}
                                                      {darkIcon ? (
                                                          <div className="relative border border-border-subtle bg-black rounded-2xl p-2 flex flex-col items-center justify-center aspect-square group/card transition-all hover:border-white/20">
                                                              <div className="absolute top-2 left-2 text-[9px] text-text-muted uppercase font-bold z-10 opacity-50"><Moon size={10}/></div>
                                                              <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                                                                <WcagBadge ratio={darkIcon.analysis?.contrastRatio} />
                                                                <span className="text-[9px] font-mono text-text-muted bg-bg-primary/80 px-1 rounded">{Math.round(darkIcon.size / 1024 * 10) / 10}KB</span>
                                                              </div>
                                                              <div className={`w-full h-full p-2 rounded-xl ${getDashboardBgClass()}`}>
                                                                  <IconMagnifier url={darkIcon.url} bgClass={getDashboardBgClass()} />
                                                              </div>
                                                              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity z-30">
                                                                  {darkIcon.width > 0 && <button onClick={() => { setEditingIcon(darkIcon); setEditOptions({scale:1, padding:0, backgroundColor: (darkIcon.originalDef.transparent || keepOriginalBackground) ? '' : brandColor, keepOriginalBackground}); }} className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-purple-600 hover:text-white shadow-lg"><Edit2 size={12}/></button>}
                                                                  <button onClick={() => handleOverrideClick(darkIcon.id)} className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-purple-600 hover:text-white shadow-lg"><UploadCloud size={12}/></button>
                                                              </div>
                                                          </div>
                                                      ) : (
                                                          <div className="border border-border-subtle border-dashed rounded-2xl flex items-center justify-center text-text-subtle text-[10px] bg-bg-tertiary/20 aspect-square">No Dark</div>
                                                      )}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
        </main>
      </div>

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 no-drag animate-fade-in">
            <div className="bg-bg-secondary w-full max-w-md rounded-3xl shadow-2xl border border-border-light overflow-hidden animate-zoom-in">
              <div className="p-6 border-b border-border-light flex justify-between items-center bg-bg-tertiary/50">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={18} className="text-purple-400"/> {t('settings')}</h3>
                  <button onClick={() => setShowSettings(false)} className="text-text-muted hover:text-white"><X size={18}/></button>
              </div>
              <div className="p-6 space-y-8">
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-3 block flex items-center gap-2"><Languages size={14}/> {t('language')}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {SUPPORTED_LANGUAGES.map((id) => (
                            <button key={id} onClick={() => setLang(id)} className={`px-4 py-2.5 text-sm rounded-xl border transition-all text-left font-medium ${lang === id ? 'bg-purple-500/10 border-purple-500/50 text-purple-300' : 'bg-bg-tertiary border-transparent text-text-secondary hover:bg-bg-tertiary/80'}`}>
                              {id.toUpperCase()}
                            </button>
                        ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-3 block flex items-center gap-2"><Palette size={14}/> {t('theme')}</label>
                    <div className="grid grid-cols-3 gap-3">
                        {SUPPORTED_THEMES.map(m => (
                            <button key={m} onClick={() => setTheme(m)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${theme === m ? 'bg-bg-primary border-purple-500 text-white shadow-lg shadow-purple-500/10' : 'bg-bg-tertiary border-transparent text-text-muted opacity-60 hover:opacity-100'}`}>
                                {m === 'light' ? <Sun size={20}/> : <Moon size={20}/>}
                                <span className="text-xs font-bold capitalize">{m}</span>
                            </button>
                        ))}
                    </div>
                  </div>
              </div>
              <div className="p-6 border-t border-border-light bg-bg-tertiary/30 flex justify-end">
                  <button onClick={() => setShowSettings(false)} className="px-8 py-2.5 bg-white text-black hover:bg-gray-200 rounded-xl text-sm font-bold shadow-lg">Done</button>
              </div>
            </div>
        </div>
      )}

      {/* --- EDITOR MODAL --- */}
      {editingIcon && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-6 no-drag animate-fade-in">
            <div className="bg-bg-secondary w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-border-light animate-zoom-in">
                {/* Editor Sidebar */}
                <div className="w-full md:w-80 bg-bg-glass border-b md:border-b-0 md:border-r border-border-light p-6 flex flex-col overflow-y-auto">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><Edit2 size={20} className="text-purple-400"/> {t('editor')}</h3>
                          <p className="text-xs text-text-muted font-mono">{editingIcon.name}</p>
                      </div>
                      <button onClick={() => setEditingIcon(null)} className="md:hidden p-2 bg-bg-tertiary rounded-full"><X size={16}/></button>
                    </div>

                    <div className="space-y-8 flex-1">
                        <div className="p-4 bg-bg-tertiary/30 rounded-xl border border-border-subtle">
                            <label className="text-xs font-bold text-text-muted uppercase mb-3 block">{t('replaceSource')}</label>
                            <button onClick={() => handleOverrideClick(editingIcon.id)} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border-light hover:border-purple-500/50 hover:bg-purple-500/10 text-text-secondary rounded-lg text-xs transition-all">
                              <FileUp size={14}/> {t('upload')}
                            </button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-muted uppercase mb-3 block">{t('viewMode')}</label>
                            <div className="flex gap-2 bg-bg-tertiary p-1 rounded-xl border border-border-subtle">
                                <button onClick={() => setModalViewMode('fit')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${modalViewMode === 'fit' ? 'bg-bg-primary text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>{t('fitScreen')}</button>
                                <button onClick={() => setModalViewMode('actual')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${modalViewMode === 'actual' ? 'bg-bg-primary text-white shadow-sm' : 'text-text-muted hover:text-white'}`}>{t('realSize')}</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-muted uppercase mb-3 block">{t('previewBg')}</label>
                            <div className="grid grid-cols-5 gap-2">
                                {PREVIEW_BACKGROUNDS.map(bg => (
                                    <button key={bg} onClick={() => setModalPreviewBg(bg)} className={`aspect-square rounded-lg border-2 transition-all ${modalPreviewBg === bg ? 'border-purple-500 scale-110' : 'border-transparent hover:border-white/20'} ${bg === 'transparent' ? "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-800" : bg === 'light' ? 'bg-white' : bg === 'dark' ? 'bg-black' : bg === 'brand' ? '' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`} style={bg === 'brand' ? {backgroundColor: brandColor} : {}}></button>
                                ))}
                            </div>
                        </div>
                        <div className="pt-6 border-t border-border-light">
                              <label className="text-xs font-bold text-text-muted uppercase mb-4 block flex justify-between">Scale <span className="text-white">{Math.round(editOptions.scale * 100)}%</span></label>
                              <input type="range" min="0.5" max="1.5" step="0.05" value={editOptions.scale} onChange={(e) => setEditOptions({...editOptions, scale: parseFloat(e.target.value)})} className="w-full accent-purple-500 h-1.5 bg-bg-tertiary rounded-lg appearance-none cursor-pointer" />
                        </div>
                        {editAnalysis && (
                            <div className="pt-6 border-t border-border-light">
                              <label className="text-xs font-bold text-text-muted uppercase mb-2 block flex items-center gap-2"><Eye size={12}/> {t('analysis')}</label>
                              <div className="space-y-2">
                                  <div className="flex items-center justify-between bg-bg-tertiary p-2 rounded-lg">
                                      <span className="text-xs text-text-secondary">{t('contrast')}</span>
                                      <WcagBadge ratio={editAnalysis.contrastRatio} />
                                  </div>
                                  <ContrastVisualizer analysis={editAnalysis} tLabel={t('detectedFail')} />
                                  {editAnalysis.suggestions?.map((msg, i) => (
                                      <div key={i} className="text-[10px] text-amber-400 flex items-start gap-2 bg-amber-500/10 p-2 rounded">
                                          <AlertTriangle size={10} className="shrink-0 mt-0.5"/> {msg}
                                      </div>
                                  ))}
                              </div>
                            </div>
                        )}
                    </div>
                    <div className="mt-6 flex gap-3">
                        <button onClick={() => setEditingIcon(null)} className="flex-1 py-3 rounded-xl border border-border-light text-text-secondary hover:bg-bg-tertiary hover:text-white text-sm font-bold transition-colors">{t('cancel')}</button>
                        <button onClick={saveEditedIcon} className="flex-1 py-3 rounded-xl bg-white text-black hover:bg-gray-200 text-sm font-bold shadow-lg transition-colors">{t('save')}</button>
                    </div>
                </div>

                {/* Editor Stage */}
                <div className="flex-1 relative bg-black flex items-center justify-center p-4 md:p-12 overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                    <div className={`relative shadow-2xl transition-all duration-300 z-10 ${modalViewMode === 'fit' ? 'w-full h-full' : ''}`} style={{ width: modalViewMode === 'actual' ? editingIcon.width : undefined, height: modalViewMode === 'actual' ? editingIcon.height : undefined }}>
                          {renderModalPreviewBackground()}
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <img src={editPreviewUrl || editingIcon.url} className={`object-contain transition-all duration-200 ${modalViewMode === 'fit' ? 'max-w-[80%] max-h-[80%]' : ''}`} style={{ width: modalViewMode === 'actual' ? '100%' : undefined, height: modalViewMode === 'actual' ? '100%' : undefined }} alt="Preview" />
                          </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;