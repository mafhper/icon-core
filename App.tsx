import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Download, Settings, Image as ImageIcon, Layers, Monitor, Smartphone, Globe, Info, Check, RefreshCw, X, AlertTriangle, Edit2, ZoomIn, Maximize, Moon, Sun, UploadCloud, Eye, LayoutTemplate, Grid, Palette, Sliders, ChevronRight, Minimize, Minus, Square, User, Languages, FileUp, Menu, Zap, ChevronLeft, ChevronDown, FolderOpen, HardDrive, Pipette, Award, Plus, Trash2, Share2, MousePointer2 } from 'lucide-react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { STANDARD_SIZES, GeneratedFile, IconCategory, IconDefinition, EditOptions, IconVariant, AppLanguage, AppTheme, ImageAnalysis } from './types';
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
    mainSources: "Arquivos de Origem",
    config: "Configuração",
    sizes: "Tamanhos de Saída",
    customSizes: "Personalizado (ex: 24, 42, 80)",
    optimization: "Otimização",
    quality: "Qualidade / Compressão",
    universal: "Logo Universal (Padrão)",
    universalDesc: "Usado se os específicos não forem fornecidos",
    lightOverride: "Para Fundo Claro (Opcional)",
    darkOverride: "Para Fundo Escuro (Opcional)",
    favUniversal: "Favicon Universal (Padrão)",
    favLightOverride: "Favicon p/ Claro (Opcional)",
    favDarkOverride: "Favicon p/ Escuro (Opcional)",
    brandColor: "Cor da Marca / Fundo",
    bgStrategy: "Estratégia de Fundo",
    bgTransparent: "Manter Transparente",
    bgFill: "Preencher Fundo",
    bgDesc: "A cor da marca será usada como fundo para imagens que não suportam transparência (Social JPGs) ou se você optar por 'Preencher Fundo'.",
    bgInfoSocial: "Social Media (JPG) sempre terá fundo preenchido.",
    generate: "Gerar Ativos",
    processing: "Processando...",
    ready: "Pronto para Gerar",
    readyDesc: "Envie pelo menos o Logo Universal. O sistema gerará as variações automaticamente.",
    download: "Baixar Pasta Zip",
    editor: "Editor e Análise",
    viewMode: "Modo de Visualização",
    fitScreen: "Ajustar à Tela",
    realSize: "Tamanho Real (1:1)",
    previewBg: "Fundo da Prévia",
    analysis: "Análise",
    detectedFail: "Contraste Baixo",
    pickColor: "Pegar cor da tela",
    gradeS: "Excelente (S)",
    gradeA: "Ótimo (A)",
    gradeB: "Bom (B)",
    gradeC: "Ruim (C)",
    gradeLabel: "Nota Geral",
    lightAssets: "Contexto Claro",
    darkAssets: "Contexto Escuro",
    simulations: "Simulações de Ambiente",
    browserSim: "Navegador Web",
    iosSim: "iOS / Android",
    winSim: "Windows / Desktop",
    optional: "Opcional",
    upload: "Enviar",
    socialHeader: "Redes Sociais",
    socialDesc: "OG Image, Twitter Card",
    hoverZoom: "Passe o mouse para ampliar"
  },
  en: {
    appName: "ICON FORGE",
    appDesc: "Professional Asset Generator",
    mainSources: "Source Files",
    config: "Configuration",
    sizes: "Output Sizes",
    customSizes: "Custom (e.g., 24, 42, 80)",
    optimization: "Optimization",
    quality: "Quality / Compression",
    universal: "Universal Logo (Default)",
    universalDesc: "Used if specifics are missing",
    lightOverride: "For Light Backgrounds (Opt)",
    darkOverride: "For Dark Backgrounds (Opt)",
    favUniversal: "Universal Favicon (Default)",
    favLightOverride: "Favicon for Light (Opt)",
    favDarkOverride: "Favicon for Dark (Opt)",
    brandColor: "Brand / Background Color",
    bgStrategy: "Background Strategy",
    bgTransparent: "Keep Transparent",
    bgFill: "Fill Background",
    bgDesc: "Brand color is used as background for non-transparent formats (Social JPGs) or if 'Fill Background' is selected.",
    bgInfoSocial: "Social Media (JPG) always has filled background.",
    generate: "Generate Assets",
    processing: "Processing...",
    ready: "Ready to Forge",
    readyDesc: "Upload at least the Universal Logo. The system creates all variations automatically.",
    download: "Download Zip Folder",
    editor: "Editor & Analysis",
    viewMode: "View Mode",
    fitScreen: "Fit Screen",
    realSize: "Real Size (1:1)",
    previewBg: "Preview Background",
    analysis: "Analysis",
    detectedFail: "Low Contrast",
    pickColor: "Pick color from screen",
    gradeS: "Perfect (S)",
    gradeA: "Great (A)",
    gradeB: "Good (B)",
    gradeC: "Poor (C)",
    gradeLabel: "Overall Grade",
    lightAssets: "Light Context",
    darkAssets: "Dark Context",
    simulations: "Environment Simulations",
    browserSim: "Web Browser",
    iosSim: "iOS / Android",
    winSim: "Windows / Desktop",
    optional: "Optional",
    upload: "Upload",
    socialHeader: "Social Media",
    socialDesc: "OG Image, Twitter Card",
    hoverZoom: "Hover to zoom"
  },
  es: {
    appName: "ICON FORGE",
    appDesc: "Generador de Activos",
    mainSources: "Fuentes",
    config: "Configuración",
    sizes: "Tamaños",
    customSizes: "Personalizado",
    optimization: "Optimización",
    quality: "Calidad",
    universal: "Logo Universal",
    universalDesc: "Usado por defecto",
    lightOverride: "Para Fondo Claro (Opc)",
    darkOverride: "Para Fondo Oscuro (Opc)",
    favUniversal: "Favicon Universal",
    favLightOverride: "Favicon Claro (Opc)",
    favDarkOverride: "Favicon Oscuro (Opc)",
    brandColor: "Color Marca / Fondo",
    bgStrategy: "Estrategia de Fondo",
    bgTransparent: "Transparente",
    bgFill: "Rellenar Fondo",
    bgDesc: "Color usado en JPGs sociales o si eliges rellenar.",
    bgInfoSocial: "Social JPG siempre tiene fondo.",
    generate: "Generar",
    processing: "Procesando...",
    ready: "Listo",
    readyDesc: "Sube el logo universal.",
    download: "Descargar Zip",
    editor: "Editor",
    viewMode: "Vista",
    fitScreen: "Ajustar",
    realSize: "Real",
    previewBg: "Fondo",
    analysis: "Análisis",
    detectedFail: "Bajo Contraste",
    pickColor: "Tomar color",
    gradeS: "Perfecto",
    gradeA: "Genial",
    gradeB: "Bueno",
    gradeC: "Pobre",
    gradeLabel: "Nota",
    lightAssets: "Contexto Claro",
    darkAssets: "Contexto Oscuro",
    simulations: "Simulaciones",
    browserSim: "Navegador",
    iosSim: "Móvil",
    winSim: "Escritorio",
    optional: "Opcional",
    upload: "Subir",
    socialHeader: "Redes Sociales",
    socialDesc: "OG Image, Twitter",
    hoverZoom: "Zoom al pasar mouse"
  },
  it: { appName: "ICON FORGE", appDesc: "Generatore", mainSources: "Fonti", config: "Configurazione", sizes: "Dimensioni", customSizes: "Personalizzato", optimization: "Ottimizzazione", quality: "Qualità", universal: "Logo Universale", universalDesc: "Default", lightOverride: "Sfondo Chiaro", darkOverride: "Sfondo Scuro", favUniversal: "Favicon Univ.", favLightOverride: "Favicon Chiaro", favDarkOverride: "Favicon Scuro", brandColor: "Colore Brand", bgStrategy: "Strategia Sfondo", bgTransparent: "Trasparente", bgFill: "Riempimento", bgDesc: "Colore usato per Social o riempimento.", bgInfoSocial: "Social JPG sempre riempito.", generate: "Genera", processing: "Attendere", ready: "Pronto", readyDesc: "Carica logo.", download: "Scarica", editor: "Editor", viewMode: "Vista", fitScreen: "Adatta", realSize: "Reale", previewBg: "Sfondo", analysis: "Analisi", detectedFail: "Contrasto Basso", pickColor: "Preleva", gradeS: "Perfetto", gradeA: "Ottimo", gradeB: "Buono", gradeC: "Scarso", gradeLabel: "Voto", lightAssets: "Contesto Chiaro", darkAssets: "Contesto Scuro", simulations: "Simulazioni", browserSim: "Browser", iosSim: "Mobile", winSim: "Desktop", optional: "Opzionale", upload: "Carica", socialHeader: "Social", socialDesc: "OG Image", hoverZoom: "Zoom al passaggio" },
  fr: { appName: "ICON FORGE", appDesc: "Générateur", mainSources: "Sources", config: "Config", sizes: "Tailles", customSizes: "Perso", optimization: "Optimisation", quality: "Qualité", universal: "Logo Universel", universalDesc: "Défaut", lightOverride: "Fond Clair", darkOverride: "Fond Sombre", favUniversal: "Favicon Univ.", favLightOverride: "Favicon Clair", favDarkOverride: "Favicon Sombre", brandColor: "Couleur Marque", bgStrategy: "Stratégie Fond", bgTransparent: "Transparent", bgFill: "Remplir", bgDesc: "Couleur utilisée pour Social ou remplissage.", bgInfoSocial: "Social JPG toujours rempli.", generate: "Générer", processing: "Traitement", ready: "Prêt", readyDesc: "Chargez le logo.", download: "Télécharger", editor: "Éditeur", viewMode: "Vue", fitScreen: "Ajuster", realSize: "Réel", previewBg: "Fond", analysis: "Analyse", detectedFail: "Contraste Faible", pickColor: "Pipette", gradeS: "Parfait", gradeA: "Super", gradeB: "Bon", gradeC: "Pauvre", gradeLabel: "Note", lightAssets: "Contexte Clair", darkAssets: "Contexte Sombre", simulations: "Simulations", browserSim: "Navigateur", iosSim: "Mobile", winSim: "Bureau", optional: "Opt", upload: "Upload", socialHeader: "Social", socialDesc: "OG Image", hoverZoom: "Zoom au survol" },
  de: { appName: "ICON FORGE", appDesc: "Generator", mainSources: "Quellen", config: "Konfig", sizes: "Größen", customSizes: "Benutzerdefiniert", optimization: "Optimierung", quality: "Qualität", universal: "Universal Logo", universalDesc: "Standard", lightOverride: "Heller Hintergrund", darkOverride: "Dunkler Hintergrund", favUniversal: "Favicon Univ.", favLightOverride: "Favicon Hell", favDarkOverride: "Favicon Dunkel", brandColor: "Markenfarbe", bgStrategy: "Hintergrund", bgTransparent: "Transparent", bgFill: "Füllen", bgDesc: "Farbe für Social oder Füllung.", bgInfoSocial: "Social JPG immer gefüllt.", generate: "Generieren", processing: "Verarbeite", ready: "Bereit", readyDesc: "Logo hochladen.", download: "Download", editor: "Editor", viewMode: "Ansicht", fitScreen: "Passend", realSize: "Echt", previewBg: "Hintergrund", analysis: "Analyse", detectedFail: "Kontrast Schwach", pickColor: "Wählen", gradeS: "Perfekt", gradeA: "Super", gradeB: "Gut", gradeC: "Schlecht", gradeLabel: "Note", lightAssets: "Heller Kontext", darkAssets: "Dunkler Kontext", simulations: "Simulationen", browserSim: "Browser", iosSim: "Mobil", winSim: "Desktop", optional: "Optional", upload: "Upload", socialHeader: "Social", socialDesc: "OG Image", hoverZoom: "Zoom bei Hover" },
  zh: { appName: "ICON FORGE", appDesc: "生成器", mainSources: "来源", config: "配置", sizes: "尺寸", customSizes: "自定义", optimization: "优化", quality: "质量", universal: "通用图标", universalDesc: "默认", lightOverride: "浅色背景", darkOverride: "深色背景", favUniversal: "通用 Favicon", favLightOverride: "Favicon 浅", favDarkOverride: "Favicon 深", brandColor: "品牌色", bgStrategy: "背景策略", bgTransparent: "保持透明", bgFill: "填充背景", bgDesc: "用于社交媒体或填充。", bgInfoSocial: "社交媒体 JPG 始终填充。", generate: "生成", processing: "处理中", ready: "就绪", readyDesc: "上传图标", download: "下载", editor: "编辑", viewMode: "视图", fitScreen: "适应", realSize: "真实", previewBg: "背景", analysis: "分析", detectedFail: "对比度低", pickColor: "吸管", gradeS: "完美", gradeA: "极好", gradeB: "良好", gradeC: "差", gradeLabel: "评分", lightAssets: "浅色环境", darkAssets: "深色环境", simulations: "模拟", browserSim: "浏览器", iosSim: "移动端", winSim: "桌面", optional: "可选", upload: "上传", socialHeader: "社交媒体", socialDesc: "OG Image", hoverZoom: "悬停放大" },
  ja: { appName: "ICON FORGE", appDesc: "ジェネレーター", mainSources: "ソース", config: "構成", sizes: "サイズ", customSizes: "カスタム", optimization: "最適化", quality: "品質", universal: "ユニバーサルロゴ", universalDesc: "デフォルト", lightOverride: "明るい背景", darkOverride: "暗い背景", favUniversal: "Favicon 共通", favLightOverride: "Favicon 明", favDarkOverride: "Favicon 暗", brandColor: "ブランド色", bgStrategy: "背景戦略", bgTransparent: "透明を保持", bgFill: "背景を塗りつぶす", bgDesc: "ソーシャルまたは塗りつぶしに使用。", bgInfoSocial: "ソーシャルJPGは常に塗りつぶされます。", generate: "生成", processing: "処理中", ready: "準備完了", readyDesc: "ロゴをアップロード", download: "ダウンロード", editor: "編集", viewMode: "表示", fitScreen: "合わせる", realSize: "実寸", previewBg: "背景", analysis: "分析", detectedFail: "低コントラスト", pickColor: "スポイト", gradeS: "完璧", gradeA: "素晴らしい", gradeB: "良い", gradeC: "悪い", gradeLabel: "成績", lightAssets: "明るいコンテキスト", darkAssets: "暗いコンテキスト", simulations: "シミュレーション", browserSim: "ブラウザ", iosSim: "モバイル", winSim: "デスクトップ", optional: "任意", upload: "アップロード", socialHeader: "ソーシャル", socialDesc: "OG Image", hoverZoom: "ホバーで拡大" }
};

// ... (Components Logo, TitleBar, WcagBadge, IconMagnifier, ContrastVisualizer, AccordionItem, UploadZone, SimulationSection remain the same) ...
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
  let color = "bg-red-500/10 text-red-400 border-red-500/20";
  let label = "FAIL";
  if (ratio >= 7) { color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"; label = "AAA"; }
  else if (ratio >= 4.5) { color = "bg-green-500/10 text-green-400 border-green-500/20"; label = "AA"; }
  else if (ratio >= 3) { color = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"; label = "AA+"; }
  return (
    <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${color} flex items-center gap-1 shadow-sm`}>
      <span>WCAG</span><span className="opacity-80">{ratio.toFixed(2)}</span>
    </div>
  );
};

const IconMagnifier = ({ url }: { url: string }) => {
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
      className="relative w-full h-full overflow-hidden rounded-lg group"
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Base Image */}
      <div className="w-full h-full flex items-center justify-center transition-opacity duration-200" style={{ opacity: isHovering ? 0 : 1 }}>
         <img src={url} className="max-w-full max-h-full object-contain" alt="icon" />
      </div>

      {/* Magnified Lens (Replaces base image on hover) */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-200"
        style={{ 
          opacity: isHovering ? 1 : 0,
          backgroundImage: `url(${url})`,
          backgroundPosition: `${position.x}% ${position.y}%`,
          backgroundSize: '250%', // Zoom level
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1 rounded backdrop-blur-sm pointer-events-none opacity-50">2.5x</div>
      </div>
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

// --- Extracted Components ---

type UploadType = 'universal' | 'light_override' | 'dark_override' | 'fav_universal' | 'fav_light_override' | 'fav_dark_override';

interface UploadZoneProps {
  file: File | null;
  preview: string | null;
  type: UploadType;
  label: string;
  desc?: string;
  icon: React.ReactNode;
  height?: string;
  optional?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  t: (k: string) => string;
  onFileSelect: (f: File, t: UploadType) => void;
  onClear: (t: UploadType) => void;
}

const UploadZone = ({ 
  file, preview, type, label, desc, icon, height = "h-32", optional = false, inputRef, t, onFileSelect, onClear 
}: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0], type);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0], type);
    }
  };

  return (
    <div className="no-drag group relative hover:scale-[1.02] transition-transform duration-200">
      <div className="flex items-center justify-between mb-2">
         <label className="text-xs font-bold text-text-subtle uppercase tracking-wider flex items-center gap-2">
            {icon} <span className="text-text-secondary">{label}</span>
         </label>
         {optional && <span className="text-[9px] font-bold text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded border border-border-subtle">{t('optional')}</span>}
      </div>
      {desc && <p className="text-[10px] text-text-muted mb-2 -mt-1 leading-tight">{desc}</p>}
      
      {!file ? (
        <label 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center ${height} border border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden ${isDragging ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/10 scale-105' : 'border-border-light bg-bg-tertiary/30 hover:bg-bg-tertiary hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5'}`}
        >
          <div className={`p-3 rounded-full bg-bg-glass mb-2 transition-transform ${isDragging ? 'scale-125' : 'group-hover:scale-110'}`}>
             <Upload className={`w-5 h-5 transition-colors ${isDragging ? 'text-white' : 'text-text-muted group-hover:text-white'}`} />
          </div>
          <span className={`text-[10px] font-medium transition-colors ${isDragging ? 'text-white' : 'text-text-muted group-hover:text-text-secondary'}`}>{isDragging ? "Drop Here" : t('upload')}</span>
          <input type="file" ref={inputRef} className="hidden" onChange={handleChange} />
        </label>
      ) : (
        <div className={`relative ${height} border border-border-light rounded-2xl bg-black overflow-hidden group`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          <img src={preview!} className="relative z-10 w-full h-full object-contain p-4" alt={label} />
          <button onClick={() => onClear(type)} className="absolute top-2 right-2 p-1.5 bg-black/80 backdrop-blur text-white rounded-full hover:bg-red-500 hover:text-white transition-colors border border-white/10 z-20"><X size={10}/></button>
        </div>
      )}
    </div>
  );
};

const SimulationSection = ({ t, lightIcons, darkIcons }: { t: (k: string) => string, lightIcons: GeneratedFile[], darkIcons: GeneratedFile[] }) => {
  const [activeTab, setActiveTab] = useState<'browser' | 'mobile' | 'desktop'>('browser');
  const [simMode, setSimMode] = useState<'light' | 'dark'>('light');

  const getIcon = (mode: 'light' | 'dark', type: 'favicon' | 'logo') => {
    const list = mode === 'light' ? lightIcons : darkIcons;
    if (type === 'favicon') {
       return list.find(i => i.originalDef.format === 'ico') || list.find(i => i.typeLabel === 'favicon' && i.width === 32) || list[0];
    }
    return list.find(i => i.width >= 64 && i.typeLabel === 'logo') || list[0];
  };

  const activeIcon = getIcon(simMode, activeTab === 'browser' ? 'favicon' : 'logo');
  if (!activeIcon) return null;

  return (
    <div className="mt-8 bg-bg-glass backdrop-blur-md border border-border-subtle rounded-3xl p-6 animate-fade-in-up">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-6">{t('simulations')}</h3>
        
        <div className="flex gap-4 mb-6">
           <div className="flex bg-bg-tertiary p-1 rounded-lg border border-border-subtle">
              <button onClick={() => setActiveTab('browser')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'browser' ? 'bg-bg-primary text-white shadow' : 'text-text-muted hover:text-white'}`}>{t('browserSim')}</button>
              <button onClick={() => setActiveTab('mobile')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'mobile' ? 'bg-bg-primary text-white shadow' : 'text-text-muted hover:text-white'}`}>{t('iosSim')}</button>
              <button onClick={() => setActiveTab('desktop')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'desktop' ? 'bg-bg-primary text-white shadow' : 'text-text-muted hover:text-white'}`}>{t('winSim')}</button>
           </div>
           <div className="flex bg-bg-tertiary p-1 rounded-lg border border-border-subtle ml-auto">
              <button onClick={() => setSimMode('light')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${simMode === 'light' ? 'bg-white text-black shadow' : 'text-text-muted hover:text-white'}`}><Sun size={12}/> Light</button>
              <button onClick={() => setSimMode('dark')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${simMode === 'dark' ? 'bg-black text-white shadow' : 'text-text-muted hover:text-white'}`}><Moon size={12}/> Dark</button>
           </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-border-light h-64 bg-zinc-900 flex items-center justify-center">
            {activeTab === 'browser' && (
               <div className={`w-full h-full flex flex-col ${simMode === 'light' ? 'bg-zinc-100' : 'bg-zinc-900'}`}>
                  {/* Fake Browser Chrome */}
                  <div className={`h-8 ${simMode === 'light' ? 'bg-zinc-200 border-b border-zinc-300' : 'bg-zinc-800 border-b border-zinc-700'} flex items-end px-2 space-x-2`}>
                      <div className={`w-40 h-7 rounded-t-lg flex items-center px-3 gap-2 ${simMode === 'light' ? 'bg-white' : 'bg-zinc-900'}`}>
                          <img src={activeIcon.url} className="w-4 h-4 object-contain" />
                          <div className={`w-20 h-2 rounded-full ${simMode === 'light' ? 'bg-zinc-100' : 'bg-zinc-800'}`}></div>
                      </div>
                  </div>
                  <div className="flex-1 p-8 flex items-center justify-center">
                      <div className="text-center opacity-30">
                          <Globe size={48} className="mx-auto mb-2"/>
                          <p className="text-xs font-mono">Browser Context</p>
                      </div>
                  </div>
               </div>
            )}

            {activeTab === 'mobile' && (
               <div className="w-full h-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-50"></div>
                  <div className="absolute inset-0 flex items-center justify-center gap-8">
                     <div className="flex flex-col items-center gap-2 animate-zoom-in">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl flex items-center justify-center overflow-hidden">
                            <img src={activeIcon.url} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] text-white font-medium drop-shadow-md">App Name</span>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'desktop' && (
                <div className={`w-full h-full relative ${simMode === 'light' ? 'bg-[url("https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2670&auto=format&fit=crop")]' : 'bg-[url("https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=2672&auto=format&fit=crop")]'} bg-cover bg-center`}>
                     <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-14 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center px-4 gap-4 shadow-2xl">
                         <div className="w-10 h-10 bg-white/20 rounded-xl"></div>
                         <div className="w-10 h-10 bg-white/20 rounded-xl"></div>
                         <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg border border-white/30 transform scale-110">
                            <img src={activeIcon.url} className="w-full h-full object-contain p-1" />
                         </div>
                         <div className="w-10 h-10 bg-white/20 rounded-xl"></div>
                     </div>
                </div>
            )}
        </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [lang, setLang] = useState<AppLanguage>('pt'); 
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); 
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
  const [universalFile, setUniversalFile] = useState<File | null>(null);
  const [universalPreview, setUniversalPreview] = useState<string | null>(null);

  const [lightFile, setLightFile] = useState<File | null>(null);
  const [lightPreview, setLightPreview] = useState<string | null>(null);

  const [darkFile, setDarkFile] = useState<File | null>(null);
  const [darkPreview, setDarkPreview] = useState<string | null>(null);

  const [favUniversalFile, setFavUniversalFile] = useState<File | null>(null);
  const [favUniversalPreview, setFavUniversalPreview] = useState<string | null>(null);

  const [favLightFile, setFavLightFile] = useState<File | null>(null);
  const [favLightPreview, setFavLightPreview] = useState<string | null>(null);

  const [favDarkFile, setFavDarkFile] = useState<File | null>(null);
  const [favDarkPreview, setFavDarkPreview] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcons, setGeneratedIcons] = useState<GeneratedFile[]>([]);
  
  const [brandColor, setBrandColor] = useState('#ffffff');
  const [keepOriginalBackground, setKeepOriginalBackground] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(0.9);

  // Size State
  const [selectedSizes, setSelectedSizes] = useState<number[]>([16, 32, 48, 64, 128, 180, 192, 512]);
  const [customSizesStr, setCustomSizesStr] = useState('');

  const [editingIcon, setEditingIcon] = useState<GeneratedFile | null>(null);
  const [editOptions, setEditOptions] = useState<EditOptions>({ scale: 1, padding: 0, backgroundColor: '' });
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [editAnalysis, setEditAnalysis] = useState<ImageAnalysis | null>(null);
  const [modalPreviewBg, setModalPreviewBg] = useState<'transparent' | 'light' | 'dark' | 'brand' | 'context'>('transparent');
  const [modalViewMode, setModalViewMode] = useState<'fit' | 'actual'>('fit');

  const mainInputRef = useRef<HTMLInputElement>(null);
  const overrideInputRef = useRef<HTMLInputElement>(null);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);

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
        // ... (keep API logic if needed, simplified here)
    });
    return cleanup;
  }, []);

  const processSelectedFile = (selectedFile: File, type: UploadType) => {
    if (!selectedFile.type.startsWith('image/')) { alert('Please upload an image file.'); return; }
    const url = URL.createObjectURL(selectedFile);
    
    // Auto-open sidebar if universal file is selected (for mobile UX flow)
    if (type === 'universal') {
       setSidebarOpen(true);
    }

    switch (type) {
      case 'universal':
        setUniversalFile(selectedFile); setUniversalPreview(url);
        const img = new Image();
        img.onload = () => { setBrandColor(getDominantColor(img)); };
        img.src = url;
        setGeneratedIcons([]);
        break;
      case 'light_override': setLightFile(selectedFile); setLightPreview(url); break;
      case 'dark_override': setDarkFile(selectedFile); setDarkPreview(url); break;
      case 'fav_universal': setFavUniversalFile(selectedFile); setFavUniversalPreview(url); break;
      case 'fav_light_override': setFavLightFile(selectedFile); setFavLightPreview(url); break;
      case 'fav_dark_override': setFavDarkFile(selectedFile); setFavDarkPreview(url); break;
    }
  };

  const handleEyedropper = async () => {
    if (!('EyeDropper' in window)) { alert("Your browser does not support the Eyedropper API."); return; }
    try {
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      setBrandColor(result.sRGBHex);
    } catch (e) { console.log('User canceled the eyedropper'); }
  };

  const clearFile = (type: UploadType) => {
    switch (type) {
      case 'universal': setUniversalFile(null); setUniversalPreview(null); setGeneratedIcons([]); break;
      case 'light_override': setLightFile(null); setLightPreview(null); break;
      case 'dark_override': setDarkFile(null); setDarkPreview(null); break;
      case 'fav_universal': setFavUniversalFile(null); setFavUniversalPreview(null); break;
      case 'fav_light_override': setFavLightFile(null); setFavLightPreview(null); break;
      case 'fav_dark_override': setFavDarkFile(null); setFavDarkPreview(null); break;
    }
  };

  const toggleSize = (size: number) => {
      setSelectedSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size].sort((a,b)=>a-b));
  };

  const generateSet = async (targetSizes: number[]) => {
    if (!universalFile) return [];
    
    const results: GeneratedFile[] = [];

    // --- Resolve Sources ---
    const srcLogoLight = lightFile || universalFile;
    const srcLogoDark = darkFile || universalFile;
    const srcFavLight = favLightFile || favUniversalFile || lightFile || universalFile;
    const srcFavDark = favDarkFile || favUniversalFile || darkFile || universalFile;

    // Helper to generate a single file
    const gen = async (src: File, size: number, mode: IconVariant, type: 'logo' | 'favicon', format: 'png' | 'ico' = 'png', explicitName?: string) => {
        const name = explicitName || `${type}-${mode}-${size}x${size}.${format}`;
        const def: IconDefinition = { name, width: size, height: size, category: 'web', transparent: true, format, type };
        
        // Pass KeepOriginal logic correctly: If keepOriginalBackground is true, logic processes transparency. If false, we force bg color.
        // wait, 'keepOriginalBackground' state implies "Do not fill transparency".
        // The processImage option 'keepOriginalBackground' when TRUE means "Don't fill".
        // So we pass the state directly.
        
        // However, if the user explicitly wants to "Fill Background", we should pass backgroundColor and ensure keepOriginal is false.
        // My state variable is named `keepOriginalBackground`. 
        // If it is TRUE (Transparent strategy), we pass true.
        // If it is FALSE (Fill strategy), we pass false and the brandColor is used.
        
        const { blob, analysis, size: byteSize } = await processImage(src, def, brandColor, { 
            scale: 1, 
            padding: 0, 
            keepOriginalBackground: keepOriginalBackground, // true = transparent, false = use brandColor
            quality: compressionQuality 
        });
        
        results.push({
            id: name,
            name,
            blob,
            url: URL.createObjectURL(blob),
            size: byteSize,
            category: 'web',
            variant: mode,
            width: size,
            height: size,
            originalDef: def,
            analysis,
            typeLabel: type
        });
        return { width: size, height: size, blob };
    };

    // 1. Generate PNGs for all sizes (Logos)
    for (const size of targetSizes) {
       await gen(srcLogoLight, size, 'light', 'logo');
       await gen(srcLogoDark, size, 'dark', 'logo');
    }

    // 2. Generate Favicon PNGs (Small sizes only)
    const faviconSizes = targetSizes.filter(s => s <= 64);
    const icoPartsLight: { width: number, height: number, blob: Blob }[] = [];
    const icoPartsDark: { width: number, height: number, blob: Blob }[] = [];

    for (const size of faviconSizes) {
        const pL = await gen(srcFavLight, size, 'light', 'favicon');
        icoPartsLight.push(pL);
        const pD = await gen(srcFavDark, size, 'dark', 'favicon');
        icoPartsDark.push(pD);
    }

    // 3. Generate ICOs (Multi-layer)
    if (icoPartsLight.length > 0) {
        const icoBlob = await generateIco(icoPartsLight);
        results.push({
            id: 'favicon-light.ico', name: 'favicon-light.ico', blob: icoBlob, url: URL.createObjectURL(icoBlob), size: icoBlob.size, category: 'web', variant: 'light', width: 32, height: 32,
            typeLabel: 'favicon', originalDef: { name: 'favicon-light.ico', width: 32, height: 32, category: 'web', transparent: true, format: 'ico', type: 'favicon' }
        });
    }
    if (icoPartsDark.length > 0) {
        const icoBlob = await generateIco(icoPartsDark);
        results.push({
            id: 'favicon-dark.ico', name: 'favicon-dark.ico', blob: icoBlob, url: URL.createObjectURL(icoBlob), size: icoBlob.size, category: 'web', variant: 'dark', width: 32, height: 32,
            typeLabel: 'favicon', originalDef: { name: 'favicon-dark.ico', width: 32, height: 32, category: 'web', transparent: true, format: 'ico', type: 'favicon' }
        });
    }

    // 4. Social Media (Force Background Color)
    const genSocial = async (src: File, w: number, h: number, name: string) => {
        const def: IconDefinition = { name, width: w, height: h, category: 'social', transparent: false, format: 'jpg', type: 'social' };
        // Force Brand Color background for Social
        const { blob, analysis, size } = await processImage(src, def, brandColor, { scale: 1, padding: 0, backgroundColor: brandColor, keepOriginalBackground: false, quality: 0.9 });
        results.push({ id: name, name, blob, url: URL.createObjectURL(blob), size, category: 'social', variant: 'light', width: w, height: h, originalDef: def, analysis, typeLabel: 'social' });
    };
    await genSocial(universalFile, 1200, 630, 'og-image.jpg');
    await genSocial(universalFile, 1200, 600, 'twitter-card.jpg');

    return results;
  };

  const handleGenerate = async () => {
    if (!universalFile) return;
    setIsGenerating(true);
    setSidebarOpen(false);
    
    // Parse custom sizes
    const customSizes = customSizesStr.split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n > 0);
    
    // Merge and Deduplicate
    const allSizes = Array.from(new Set([...selectedSizes, ...customSizes])).sort((a,b)=>a-b);

    try {
      const generated = await generateSet(allSizes);
      setGeneratedIcons(generated);
    } catch (error) { console.error(error); alert("Error generating icons"); } finally { setIsGenerating(false); }
  };

  const handleDownload = async () => {
    if (generatedIcons.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("icon-forge-assets");
    generatedIcons.forEach(icon => folder?.file(icon.name, icon.blob));
    const content = await zip.generateAsync({ type: "blob" });
    FileSaver.saveAs(content, "icon-forge-assets.zip");
  };

  // Re-run processing for Editor
  useEffect(() => {
    let isCancelled = false;
    const updatePreview = async () => {
      if (!editingIcon) return;
      // Resolve source just for re-previewing in editor
      let source = universalFile;
      // Try to find the specific source that likely generated this
      if (editingIcon.typeLabel === 'favicon') {
          if (editingIcon.variant === 'dark') source = favDarkFile || favUniversalFile || darkFile || universalFile;
          else source = favLightFile || favUniversalFile || lightFile || universalFile;
      } else {
          if (editingIcon.variant === 'dark') source = darkFile || universalFile;
          else source = lightFile || universalFile;
      }
      
      if (!source) return;

      try {
        const { blob, analysis } = await processImage(source, editingIcon.originalDef, brandColor, editOptions);
        if (!isCancelled) { 
            if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl); 
            setEditPreviewUrl(URL.createObjectURL(blob)); 
            setEditAnalysis(analysis); 
        }
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

  const renderIconCard = (icon: GeneratedFile, themeContext: 'light' | 'dark') => (
      <div key={icon.id} className="group/card flex flex-col items-center animate-fade-in-up">
          {/* Main Card Container */}
          <div className={`relative border rounded-xl w-full aspect-square transition-all hover:shadow-xl hover:border-purple-500/50 overflow-hidden flex flex-col ${themeContext === 'light' ? 'bg-white border-black/10' : 'bg-zinc-800 border-white/10'}`}>
              
              {/* Icon Area with Magnifier */}
              <div className="flex-1 relative p-3 flex items-center justify-center overflow-hidden">
                   <div className="w-full h-full">
                       <IconMagnifier url={icon.url} />
                   </div>
                   
                   {/* Hover Action (Edit) */}
                   <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-200 translate-x-2 group-hover/card:translate-x-0">
                      {icon.width > 0 && <button onClick={() => { setEditingIcon(icon); setEditOptions({scale:1, padding:0, backgroundColor: (!keepOriginalBackground) ? brandColor : '', keepOriginalBackground}); }} className="p-1.5 bg-zinc-900 text-zinc-300 rounded-lg hover:bg-purple-600 hover:text-white shadow-lg border border-white/10" title="Edit"><Edit2 size={12}/></button>}
                   </div>
              </div>

              {/* Info Bar (Separated from image to avoid overlap) */}
              <div className={`h-8 border-t flex items-center justify-between px-3 text-[10px] font-mono shrink-0 ${themeContext === 'light' ? 'bg-zinc-50 border-black/5 text-gray-500' : 'bg-zinc-900 border-white/5 text-gray-400'}`}>
                  <span className="font-bold">{icon.width > 0 ? `${icon.width}px` : 'SVG'}</span>
                  <WcagBadge ratio={icon.analysis?.contrastRatio} />
              </div>
          </div>
          
          {/* Filename below card */}
          <span className="mt-2 text-[10px] text-gray-400 font-mono truncate w-full text-center px-1 select-all" title={icon.name}>{icon.name}</span>
      </div>
  );

  return (
    <div className="h-screen bg-bg-primary text-text-primary font-sans flex flex-col overflow-hidden relative selection:bg-purple-500/30 selection:text-white">
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none opacity-40"></div>
      
      <TitleBar onOpenSettings={() => setShowSettings(true)} />

      {/* --- HEADER --- */}
      <header className="h-16 border-b border-border-subtle bg-bg-glass backdrop-blur-md flex items-center justify-between px-4 md:px-8 shrink-0 no-drag z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-text-muted hover:text-white"><Menu size={20} /></button>
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-primary rounded-lg shadow-lg shadow-purple-500/20"><Layers size={18} className="text-white"/></div>
                <h1 className="font-bold text-sm tracking-widest hidden sm:block">ICON FORGE</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
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
        <input type="file" ref={overrideInputRef} hidden accept="image/*" />

        {/* --- SIDEBAR --- */}
        <aside 
            className={`fixed md:static inset-y-0 left-0 z-40 bg-bg-glass backdrop-blur-xl border-r border-border-subtle flex flex-col shrink-0 animate-slide-in-left ${sidebarOpen ? 'flex' : 'hidden md:flex'} ${sidebarCollapsed ? 'w-20' : 'w-80 lg:w-96'} transition-[width] duration-300`}
        >
            <div className="p-4 md:hidden flex justify-between items-center border-b border-border-subtle">
                    <span className="font-bold text-white">{t('appName')}</span>
                    <button onClick={() => setSidebarOpen(false)}><X size={20} className="text-text-muted"/></button>
            </div>

            <div className={`flex-1 overflow-y-auto overflow-x-hidden ${sidebarCollapsed ? 'px-2 py-4' : 'px-6 py-4'}`}>
                {/* Uploads */}
                {!sidebarCollapsed ? (
                    <AccordionItem title={t('mainSources')} icon={<FolderOpen size={14} className="text-purple-400" />} defaultOpen collapsed={sidebarCollapsed}>
                        <div className="space-y-6">
                            <UploadZone file={universalFile} preview={universalPreview} type="universal" label={t('universal')} desc={t('universalDesc')} icon={<Layers size={14} className="text-blue-400" />} inputRef={mainInputRef} t={t} onFileSelect={processSelectedFile} onClear={clearFile} />
                            
                            <div className="pl-4 border-l border-border-subtle space-y-4">
                                <UploadZone file={lightFile} preview={lightPreview} type="light_override" label={t('lightOverride')} icon={<Sun size={14} className="text-amber-400" />} optional height="h-24" t={t} onFileSelect={processSelectedFile} onClear={clearFile} />
                                <UploadZone file={darkFile} preview={darkPreview} type="dark_override" label={t('darkOverride')} icon={<Moon size={14} className="text-purple-400" />} optional height="h-24" t={t} onFileSelect={processSelectedFile} onClear={clearFile} />
                            </div>

                            <div className="pt-4 border-t border-border-subtle">
                                <h4 className="text-[10px] font-bold text-text-muted uppercase mb-4 opacity-70">Favicon Specifics</h4>
                                <div className="space-y-4">
                                    <UploadZone file={favUniversalFile} preview={favUniversalPreview} type="fav_universal" label={t('favUniversal')} icon={<Minimize size={14} className="text-gray-400" />} optional height="h-24" t={t} onFileSelect={processSelectedFile} onClear={clearFile} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <UploadZone file={favLightFile} preview={favLightPreview} type="fav_light_override" label={t('favLightOverride')} icon={<Sun size={14} className="text-gray-500" />} optional height="h-20" t={t} onFileSelect={processSelectedFile} onClear={clearFile} />
                                        <UploadZone file={favDarkFile} preview={favDarkPreview} type="fav_dark_override" label={t('favDarkOverride')} icon={<Moon size={14} className="text-gray-500" />} optional height="h-20" t={t} onFileSelect={processSelectedFile} onClear={clearFile} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AccordionItem>
                ) : (
                    <div className="flex flex-col gap-4 items-center">
                        <button onClick={() => setSidebarCollapsed(false)} className="p-3 bg-bg-tertiary rounded-xl hover:bg-purple-500/20 text-text-muted hover:text-white transition-colors"><FolderOpen size={18}/></button>
                    </div>
                )}

                {/* Sizes */}
                    {!sidebarCollapsed ? (
                    <AccordionItem title={t('sizes')} icon={<LayoutTemplate size={14} className="text-pink-400" />} collapsed={sidebarCollapsed}>
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {STANDARD_SIZES.map(size => (
                                    <button 
                                        key={size}
                                        onClick={() => toggleSize(size)}
                                        className={`px-3 py-1 rounded-md text-xs font-mono border transition-all ${selectedSizes.includes(size) ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-bg-tertiary border-transparent text-text-muted hover:border-white/20'}`}
                                    >
                                        {size}px
                                    </button>
                                ))}
                            </div>
                            <div className="pt-2 border-t border-border-subtle">
                                <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">{t('customSizes')}</label>
                                <input 
                                    type="text" 
                                    value={customSizesStr}
                                    onChange={(e) => setCustomSizesStr(e.target.value)}
                                    placeholder="e.g. 24, 42, 80"
                                    className="w-full bg-bg-tertiary border border-border-light rounded-lg px-3 py-2 text-xs font-mono focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </AccordionItem>
                ) : null}

                {/* Configuration */}
                {!sidebarCollapsed ? (
                    <AccordionItem title={t('config')} icon={<Sliders size={14} className="text-blue-400" />} collapsed={sidebarCollapsed}>
                    <div className="space-y-6">
                        {/* Color Picker */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-text-subtle uppercase tracking-wider">{t('brandColor')}</label>
                                <div className="flex gap-2 items-center">
                                    {'EyeDropper' in window && (
                                    <button 
                                        onClick={handleEyedropper} 
                                        className="p-1.5 bg-bg-tertiary hover:bg-purple-500 hover:text-white rounded-lg border border-border-light text-text-muted transition-colors"
                                        title={t('pickColor')}
                                    >
                                        <Pipette size={14} />
                                    </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative group/color w-full">
                                    <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-full h-10 bg-transparent border-0 cursor-pointer rounded-lg overflow-hidden opacity-0 absolute inset-0 z-10" />
                                    <div className="w-full h-10 rounded-lg border border-border-light shadow-sm overflow-hidden flex items-center justify-center font-mono text-xs font-bold text-white text-shadow-sm" style={{backgroundColor: brandColor}}>
                                        {brandColor}
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-text-muted leading-relaxed flex gap-2">
                                <Info size={12} className="shrink-0 mt-0.5" />
                                {t('bgInfoSocial')}
                            </p>
                        </div>

                        {/* Background Strategy */}
                        <div className="space-y-3 pt-4 border-t border-border-subtle">
                            <label className="text-xs font-bold text-text-subtle uppercase tracking-wider">{t('bgStrategy')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setKeepOriginalBackground(true)}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-xs font-bold ${keepOriginalBackground ? 'bg-bg-tertiary border-purple-500 text-white' : 'bg-transparent border-border-light text-text-muted hover:bg-bg-tertiary'}`}
                                >
                                    <div className="w-full h-6 rounded bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-zinc-800 opacity-50"></div>
                                    {t('bgTransparent')}
                                </button>
                                <button 
                                    onClick={() => setKeepOriginalBackground(false)}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-xs font-bold ${!keepOriginalBackground ? 'bg-bg-tertiary border-purple-500 text-white' : 'bg-transparent border-border-light text-text-muted hover:bg-bg-tertiary'}`}
                                >
                                    <div className="w-full h-6 rounded" style={{backgroundColor: brandColor}}></div>
                                    {t('bgFill')}
                                </button>
                            </div>
                            <p className="text-[10px] text-text-muted leading-relaxed">
                                {t('bgDesc')}
                            </p>
                        </div>
                    </div>
                    </AccordionItem>
                ) : null}
            </div>

            <div className="p-4 border-t border-border-subtle flex justify-end no-drag bg-bg-tertiary/20">
                    <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
            </div>

            <div className={`p-6 bg-gradient-to-t from-bg-primary via-bg-primary/90 to-transparent sticky bottom-0 no-drag ${sidebarCollapsed ? 'px-2' : ''}`}>
                <button 
                onClick={handleGenerate}
                disabled={!universalFile || isGenerating}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${!universalFile ? 'bg-bg-tertiary text-text-muted cursor-not-allowed' : 'bg-gradient-primary text-white shadow-[0_0_40px_-10px_rgba(168,85,247,0.4)] hover:shadow-[0_0_60px_-10px_rgba(168,85,247,0.6)]'}`}
                >
                {isGenerating ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
                {!sidebarCollapsed && (isGenerating ? t('processing') : t('generate'))}
                </button>
            </div>
        </aside>
        
        {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>}

        {/* --- MAIN DASHBOARD (SPLIT VIEW) --- */}
        <main className="flex-1 flex flex-col min-w-0 bg-black relative overflow-y-auto">
          {generatedIcons.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-text-muted animate-fade-in-up p-8">
                      <div onClick={() => mainInputRef.current?.click()} className="cursor-pointer w-40 h-40 rounded-[2.5rem] bg-bg-tertiary border border-border-light flex items-center justify-center mb-8 shadow-2xl shadow-purple-500/10 relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
                          <div className="transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                              <ImageIcon size={64} className="opacity-20 text-white" />
                          </div>
                          <div className="absolute bottom-4 text-[10px] font-bold uppercase tracking-widest text-text-muted group-hover:text-white transition-colors">Click Upload</div>
                      </div>
                      <h3 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight text-center">{t('ready')}</h3>
                      <p className="max-w-md text-center text-text-secondary leading-relaxed mb-8 text-sm md:text-base">{t('readyDesc')}</p>
                  </div>
              ) : (
                <div className="flex flex-col min-h-full">
                    {/* SPLIT VIEW */}
                    <div className="flex flex-col xl:flex-row flex-1 border-b border-border-subtle">
                        {/* LIGHT CONTEXT */}
                        <div className="flex-1 bg-[#f4f4f5] p-8">
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                                <Sun size={14} className="text-amber-500"/> {t('lightAssets')}
                            </h2>
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-4 opacity-50">Logos</h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {generatedIcons.filter(i => i.variant === 'light' && i.typeLabel === 'logo').map(i => renderIconCard(i, 'light'))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-4 opacity-50">Favicons</h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {generatedIcons.filter(i => i.variant === 'light' && i.typeLabel === 'favicon').map(i => renderIconCard(i, 'light'))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* DARK CONTEXT */}
                        <div className="flex-1 bg-[#18181b] p-8 border-l border-white/5">
                            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                                <Moon size={14} className="text-purple-500"/> {t('darkAssets')}
                            </h2>
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-[10px] font-bold text-zinc-600 uppercase mb-4 opacity-50">Logos</h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {generatedIcons.filter(i => i.variant === 'dark' && i.typeLabel === 'logo').map(i => renderIconCard(i, 'dark'))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-bold text-zinc-600 uppercase mb-4 opacity-50">Favicons</h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {generatedIcons.filter(i => i.variant === 'dark' && i.typeLabel === 'favicon').map(i => renderIconCard(i, 'dark'))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SOCIAL & SIMULATIONS */}
                    <div className="p-8 bg-black">
                        <div className="max-w-7xl mx-auto space-y-12">
                             {/* Social Media Section */}
                            <div>
                                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-6 flex items-center gap-3">
                                    <Share2 size={14} className="text-pink-500"/> {t('socialHeader')}
                                    <span className="text-[10px] opacity-50 normal-case tracking-normal">({t('socialDesc')})</span>
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {generatedIcons.filter(i => i.typeLabel === 'social').map(icon => (
                                        <div key={icon.id} className="group relative">
                                            <div className="aspect-[1.91/1] w-full rounded-2xl overflow-hidden border border-white/10 relative">
                                                <img src={icon.url} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button onClick={() => { setEditingIcon(icon); setEditOptions({scale:1, padding:0, backgroundColor: brandColor, keepOriginalBackground: false}); }} className="p-2 bg-white text-black rounded-lg hover:bg-gray-200"><Edit2 size={16}/></button>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex justify-between items-center px-1">
                                                <span className="text-xs font-mono text-gray-500">{icon.name}</span>
                                                <span className="text-[10px] text-gray-600">{icon.width}x{icon.height}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <SimulationSection t={t} lightIcons={generatedIcons.filter(i => i.variant === 'light')} darkIcons={generatedIcons.filter(i => i.variant === 'dark')} />
                        </div>
                    </div>
                </div>
              )}
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