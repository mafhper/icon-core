import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Settings, Image as ImageIcon, Layers, Monitor, Smartphone, Globe, Info, Check, RefreshCw, X, AlertTriangle, Edit2, ZoomIn, Maximize, Moon, Sun, UploadCloud, Eye, LayoutTemplate, Grid, Palette, Sliders, ChevronRight, Minimize, Minus, Square, User, Languages } from 'lucide-react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { ICON_DEFINITIONS, GeneratedFile, IconCategory, IconDefinition, EditOptions, IconVariant, AppLanguage, AppTheme } from './types';
import { processImage, getDominantColor } from './utils/imageProcessor';
import { generateIco } from './utils/icoGenerator';

// --- Translations ---
const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  pt: {
    appName: "Icon Forge",
    appDesc: "Gerador Profissional de Ativos",
    mainSources: "Fontes Principais",
    primary: "Principal (>128px)",
    darkMode: "Modo Escuro (>128px)",
    smallSizes: "Tamanhos Pequenos",
    lightSmall: "Claro (<128px)",
    darkSmall: "Escuro (<128px)",
    brandColor: "Cor da Marca",
    preserveBg: "Preservar Fundo",
    preserveBgDesc: "Não preencher áreas transparentes com a cor da marca.",
    generate: "Gerar Ativos",
    processing: "Processando...",
    ready: "Pronto para Forjar",
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
    replace: "Substituir",
    light: "Claro",
    dark: "Escuro",
    design: "Design",
  },
  en: {
    appName: "Icon Forge",
    appDesc: "Professional Asset Generator",
    mainSources: "Main Sources",
    primary: "Primary (>128px)",
    darkMode: "Dark Mode (>128px)",
    smallSizes: "Small Sizes",
    lightSmall: "Light (<128px)",
    darkSmall: "Dark (<128px)",
    brandColor: "Brand Color",
    preserveBg: "Preserve Source Bg",
    preserveBgDesc: "Don't fill transparent areas with brand color.",
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
  },
  es: {
    appName: "Icon Forge",
    appDesc: "Generador de Activos Profesional",
    mainSources: "Fuentes Principales",
    primary: "Principal (>128px)",
    darkMode: "Modo Oscuro (>128px)",
    smallSizes: "Tamaños Pequeños",
    lightSmall: "Claro (<128px)",
    darkSmall: "Oscuro (<128px)",
    brandColor: "Color de Marca",
    preserveBg: "Preservar Fondo",
    preserveBgDesc: "No rellenar áreas transparentes con color de marca.",
    generate: "Generar Activos",
    processing: "Procesando...",
    ready: "Listo para Forjar",
    readyDesc: "Sube tu logo para generar activos optimizados para Web, iOS, Android y Windows.",
    download: "Descargar Todo",
    all: "Todos",
    web: "Web",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "Social",
    editor: "Editor y Análisis",
    viewMode: "Modo Vista",
    fitScreen: "Ajustar",
    realSize: "Tamaño Real (1:1)",
    previewBg: "Fondo Previsual",
    analysis: "Análisis",
    goodVisibility: "Buena visibilidad detectada.",
    save: "Guardar",
    cancel: "Cancelar",
    settings: "Preferencias",
    language: "Idioma",
    theme: "Tema",
    optional: "Opcional",
    upload: "Subir",
    replace: "Reemplazar",
    light: "Claro",
    dark: "Oscuro",
    design: "Diseño",
  },
  it: {
    appName: "Icon Forge",
    appDesc: "Generatore Professionale",
    mainSources: "Fonti Principali",
    primary: "Principale (>128px)",
    darkMode: "Modo Scuro (>128px)",
    smallSizes: "Piccole Dimensioni",
    lightSmall: "Chiaro (<128px)",
    darkSmall: "Scuro (<128px)",
    brandColor: "Colore Brand",
    preserveBg: "Preserva Sfondo",
    preserveBgDesc: "Non riempire aree trasparenti.",
    generate: "Genera Asset",
    processing: "Elaborazione...",
    ready: "Pronto a Forgiare",
    readyDesc: "Carica il tuo logo per generare asset per Web, iOS, Android e Windows.",
    download: "Scarica Tutto",
    all: "Tutti",
    web: "Web",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "Social",
    editor: "Editor e Analisi",
    viewMode: "Modalità Visualizzazione",
    fitScreen: "Adatta",
    realSize: "Reale (1:1)",
    previewBg: "Sfondo Anteprima",
    analysis: "Analisi",
    goodVisibility: "Buona visibilità rilevata.",
    save: "Salva",
    cancel: "Annulla",
    settings: "Preferenze",
    language: "Lingua",
    theme: "Tema",
    optional: "Opzionale",
    upload: "Carica",
    replace: "Sostituisci",
    light: "Chiaro",
    dark: "Scuro",
    design: "Design",
  },
  fr: {
    appName: "Icon Forge",
    appDesc: "Générateur Professionnel",
    mainSources: "Sources Principales",
    primary: "Principal (>128px)",
    darkMode: "Mode Sombre (>128px)",
    smallSizes: "Petites Tailles",
    lightSmall: "Clair (<128px)",
    darkSmall: "Sombre (<128px)",
    brandColor: "Couleur de Marque",
    preserveBg: "Préserver le Fond",
    preserveBgDesc: "Ne pas remplir les zones transparentes.",
    generate: "Générer",
    processing: "Traitement...",
    ready: "Prêt à Forger",
    readyDesc: "Téléchargez votre logo pour générer des actifs pour Web, iOS, Android et Windows.",
    download: "Tout Télécharger",
    all: "Tous",
    web: "Web",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "Social",
    editor: "Éditeur et Analyse",
    viewMode: "Mode d'Affichage",
    fitScreen: "Ajuster",
    realSize: "Taille Réelle",
    previewBg: "Fond d'Aperçu",
    analysis: "Analyse",
    goodVisibility: "Bonne visibilité détectée.",
    save: "Sauvegarder",
    cancel: "Annuler",
    settings: "Préférences",
    language: "Langue",
    theme: "Thème",
    optional: "Optionnel",
    upload: "Télécharger",
    replace: "Remplacer",
    light: "Clair",
    dark: "Sombre",
    design: "Design",
  },
  de: {
    appName: "Icon Forge",
    appDesc: "Professioneller Generator",
    mainSources: "Hauptquellen",
    primary: "Primär (>128px)",
    darkMode: "Dunkelmodus (>128px)",
    smallSizes: "Kleine Größen",
    lightSmall: "Hell (<128px)",
    darkSmall: "Dunkel (<128px)",
    brandColor: "Markenfarbe",
    preserveBg: "Hintergrund bewahren",
    preserveBgDesc: "Transparente Bereiche nicht füllen.",
    generate: "Generieren",
    processing: "Verarbeitung...",
    ready: "Bereit zum Schmieden",
    readyDesc: "Laden Sie Ihr Logo hoch, um Assets für Web, iOS, Android und Windows zu generieren.",
    download: "Alles herunterladen",
    all: "Alle",
    web: "Web",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "Sozial",
    editor: "Editor & Analyse",
    viewMode: "Ansichtsmodus",
    fitScreen: "Anpassen",
    realSize: "Echtgröße",
    previewBg: "Vorschau-Hintergrund",
    analysis: "Analyse",
    goodVisibility: "Gute Sichtbarkeit erkannt.",
    save: "Speichern",
    cancel: "Abbrechen",
    settings: "Einstellungen",
    language: "Sprache",
    theme: "Thema",
    optional: "Optional",
    upload: "Hochladen",
    replace: "Ersetzen",
    light: "Hell",
    dark: "Dunkel",
    design: "Design",
  },
  zh: {
    appName: "Icon Forge",
    appDesc: "专业图标生成器",
    mainSources: "主要来源",
    primary: "主要 (>128px)",
    darkMode: "深色模式 (>128px)",
    smallSizes: "小尺寸",
    lightSmall: "亮色 (<128px)",
    darkSmall: "深色 (<128px)",
    brandColor: "品牌颜色",
    preserveBg: "保留背景",
    preserveBgDesc: "不要填充透明区域。",
    generate: "生成资产",
    processing: "处理中...",
    ready: "准备锻造",
    readyDesc: "上传您的徽标以生成适用于Web，iOS，Android和Windows的优化资产。",
    download: "全部下载",
    all: "全部",
    web: "网络",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "社交",
    editor: "编辑与分析",
    viewMode: "查看模式",
    fitScreen: "适应屏幕",
    realSize: "实际大小",
    previewBg: "预览背景",
    analysis: "分析",
    goodVisibility: "检测到良好的可见性。",
    save: "保存",
    cancel: "取消",
    settings: "首选项",
    language: "语言",
    theme: "主题",
    optional: "可选",
    upload: "上传",
    replace: "替换",
    light: "亮色",
    dark: "深色",
    design: "设计",
  },
  ja: {
    appName: "Icon Forge",
    appDesc: "プロフェッショナル資産ジェネレーター",
    mainSources: "主なソース",
    primary: "プライマリ (>128px)",
    darkMode: "ダークモード (>128px)",
    smallSizes: "小さいサイズ",
    lightSmall: "ライト (<128px)",
    darkSmall: "ダーク (<128px)",
    brandColor: "ブランドカラー",
    preserveBg: "背景を保持",
    preserveBgDesc: "透明領域を塗りつぶさない。",
    generate: "資産を生成",
    processing: "処理中...",
    ready: "鍛造の準備完了",
    readyDesc: "ロゴをアップロードして、Web、iOS、Android、Windows用の最適化された資産を生成します。",
    download: "すべてダウンロード",
    all: "すべて",
    web: "ウェブ",
    ios: "iOS",
    pwa: "PWA",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    social: "ソーシャル",
    editor: "エディタと分析",
    viewMode: "表示モード",
    fitScreen: "画面に合わせる",
    realSize: "実サイズ",
    previewBg: "プレビュー背景",
    analysis: "分析",
    goodVisibility: "良好な視認性が検出されました。",
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
  }
};

// --- Native Title Bar Component ---
const TitleBar = ({ onOpenSettings }: { onOpenSettings: () => void }) => (
  <div className="h-8 bg-slate-950 flex items-center justify-between select-none titlebar-drag-region border-b border-slate-900 w-full shrink-0 z-50">
    <div className="flex items-center px-3 gap-2">
      <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center text-[8px] font-bold text-white">IF</div>
      <span className="text-xs text-slate-400 font-medium">Icon Forge</span>
    </div>
    
    <div className="flex h-full no-drag">
      <button onClick={onOpenSettings} className="px-3 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors flex items-center justify-center" title="Settings">
        <Settings size={14} />
      </button>
      <button className="px-3 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors flex items-center justify-center" title="Minimize">
        <Minus size={14} />
      </button>
      <button className="px-3 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors flex items-center justify-center" title="Maximize">
        <Square size={12} />
      </button>
      <button className="px-3 hover:bg-red-900 hover:text-red-200 text-slate-500 transition-colors flex items-center justify-center group" title="Close">
        <X size={14} />
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  // --- Localization & Theme State ---
  const [lang, setLang] = useState<AppLanguage>('pt'); // Default to PT as requested
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [showSettings, setShowSettings] = useState(false);

  // Load User Preferences on Mount
  useEffect(() => {
    // 1. Theme
    const savedTheme = localStorage.getItem('if-theme') as AppTheme;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // 2. Language
    const savedLang = localStorage.getItem('if-lang') as AppLanguage;
    if (savedLang) {
      setLang(savedLang);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0];
      const supportedLangs: AppLanguage[] = ['pt', 'en', 'es', 'it', 'fr', 'de', 'zh', 'ja'];
      if (supportedLangs.includes(browserLang as AppLanguage)) {
        setLang(browserLang as AppLanguage);
      }
    }
  }, []);

  // Apply Theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('if-theme', theme);
  }, [theme]);

  // Persist Language
  useEffect(() => {
    localStorage.setItem('if-lang', lang);
  }, [lang]);

  const t = (key: string) => {
    return TRANSLATIONS[lang][key] || TRANSLATIONS['en'][key] || key;
  };

  // --- Global State ---
  // Main Sources (> 128px)
  const [file, setFile] = useState<File | null>(null);
  const [darkFile, setDarkFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [darkPreviewUrl, setDarkPreviewUrl] = useState<string | null>(null);

  // Small Sources (< 128px) - e.g. for favicons
  const [smallFile, setSmallFile] = useState<File | null>(null);
  const [smallDarkFile, setSmallDarkFile] = useState<File | null>(null);
  const [smallPreviewUrl, setSmallPreviewUrl] = useState<string | null>(null);
  const [smallDarkPreviewUrl, setSmallDarkPreviewUrl] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIcons, setGeneratedIcons] = useState<GeneratedFile[]>([]);
  const [activeTab, setActiveTab] = useState<IconCategory | 'all'>('all');
  
  // --- Global Configuration ---
  const [brandColor, setBrandColor] = useState('#ffffff');
  const [keepOriginalBackground, setKeepOriginalBackground] = useState(false);
  
  // --- Dashboard View State ---
  const [dashboardPreviewBg, setDashboardPreviewBg] = useState<'checkered' | 'white' | 'black'>('checkered');

  // --- Edit Modal State ---
  const [editingIcon, setEditingIcon] = useState<GeneratedFile | null>(null);
  const [editOptions, setEditOptions] = useState<EditOptions>({ scale: 1, padding: 0, backgroundColor: '' });
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [editAnalysis, setEditAnalysis] = useState<string[]>([]);
  const [modalPreviewBg, setModalPreviewBg] = useState<'transparent' | 'light' | 'dark' | 'brand' | 'context'>('transparent');
  const [modalViewMode, setModalViewMode] = useState<'fit' | 'actual'>('fit');

  // --- Hidden Inputs ---
  const mainInputRef = useRef<HTMLInputElement>(null);
  const overrideInputRef = useRef<HTMLInputElement>(null);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);


  // --- Handlers ---

  type UploadType = 'main' | 'dark' | 'small' | 'small-dark';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: UploadType) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
      }
      
      const url = URL.createObjectURL(selectedFile);
      
      switch (type) {
        case 'main':
          setFile(selectedFile);
          setPreviewUrl(url);
          // Auto-detect brand color from primary image
          const img = new Image();
          img.onload = () => {
              const color = getDominantColor(img);
              setBrandColor(color);
          };
          img.src = url;
          // Clear previous generations on main file change
          setGeneratedIcons([]);
          break;
        case 'dark':
          setDarkFile(selectedFile);
          setDarkPreviewUrl(url);
          break;
        case 'small':
          setSmallFile(selectedFile);
          setSmallPreviewUrl(url);
          break;
        case 'small-dark':
          setSmallDarkFile(selectedFile);
          setSmallDarkPreviewUrl(url);
          break;
      }
    }
  };

  const clearFile = (type: UploadType) => {
    switch (type) {
      case 'main':
        setFile(null);
        setPreviewUrl(null);
        setGeneratedIcons([]);
        break;
      case 'dark':
        setDarkFile(null);
        setDarkPreviewUrl(null);
        break;
      case 'small':
        setSmallFile(null);
        setSmallPreviewUrl(null);
        break;
      case 'small-dark':
        setSmallDarkFile(null);
        setSmallDarkPreviewUrl(null);
        break;
    }
  };

  const generateSet = async (
    mainSource: File, 
    smallSource: File | null, 
    variant: IconVariant
  ): Promise<GeneratedFile[]> => {
    const results: GeneratedFile[] = [];
    
    // 1. Standard PNG/JPG Generation
    for (const def of ICON_DEFINITIONS) {
      let fileName = def.name;
      if (variant === 'dark') {
        const parts = def.name.split('.');
        const ext = parts.pop();
        fileName = `${parts.join('.')}-dark.${ext}`;
      }

      // Logic: If icon is small (< 128px) and a small source exists, use it.
      // Otherwise use main source.
      let sourceToUse = mainSource;
      if (def.width > 0 && def.width < 128 && smallSource) {
        sourceToUse = smallSource;
      }

      // Important: Pass the keepOriginalBackground flag here
      const { blob, analysis } = await processImage(sourceToUse, def, brandColor, { 
        scale: 1, 
        padding: 0, 
        keepOriginalBackground 
      });

      const url = URL.createObjectURL(blob);
      results.push({
        id: `${variant}-${def.name}`,
        name: fileName,
        blob,
        url,
        category: def.category,
        variant: variant,
        width: def.width,
        height: def.height,
        originalDef: def,
        analysis
      });
    }

    // 2. ICO Generation
    const icoSizes = [16, 32, 48, 64]; 
    const icoBlobs: { width: number, height: number, blob: Blob }[] = [];
    
    // Use small source for ICO if available, as ICOs are inherently small
    const icoSource = smallSource || mainSource;

    for (const size of icoSizes) {
      const tempConfig: IconDefinition = {
        name: `temp-${size}`,
        width: size,
        height: size,
        category: 'web',
        transparent: true,
        format: 'png'
      };
      const { blob } = await processImage(icoSource, tempConfig, brandColor, { 
        scale: 1, 
        padding: 0, 
        keepOriginalBackground 
      });
      icoBlobs.push({ width: size, height: size, blob });
    }

    const icoBlob = await generateIco(icoBlobs);
    const icoUrl = URL.createObjectURL(icoBlob);
    const icoName = variant === 'dark' ? 'favicon-dark.ico' : 'favicon.ico';
    
    results.unshift({
      id: `${variant}-favicon.ico`,
      name: icoName,
      blob: icoBlob,
      url: icoUrl,
      category: 'web',
      variant: variant,
      width: 32, 
      height: 32,
      originalDef: { name: icoName, width: 32, height: 32, category: 'web', transparent: true, format: 'ico', label: 'Legacy Favicon (ICO)' }
    });

    // 3. SVG Passthrough
    const svgSource = (smallSource && smallSource.type === 'image/svg+xml') ? smallSource : mainSource;

    if (svgSource.type === 'image/svg+xml') {
      const svgName = variant === 'dark' ? 'favicon-dark.svg' : 'favicon.svg';
      results.push({
        id: `${variant}-favicon.svg`,
        name: svgName,
        blob: svgSource,
        url: URL.createObjectURL(svgSource),
        category: 'web',
        variant: variant,
        width: 0,
        height: 0,
        originalDef: { name: svgName, width: 0, height: 0, category: 'web', transparent: true, format: 'png', label: 'Modern Favicon (SVG)' }
      });
    }

    return results;
  };

  const handleGenerate = async () => {
    if (!file) return;

    setIsGenerating(true);
    
    try {
      // Generate Light Set
      const lightSet = await generateSet(file, smallFile, 'light');
      let finalSet = [...lightSet];

      // Generate Dark Set
      if (darkFile) {
        const darkSet = await generateSet(darkFile, smallDarkFile, 'dark');
        finalSet = [...finalSet, ...darkSet];
      }

      setGeneratedIcons(finalSet);
    } catch (error) {
      console.error("Generation failed", error);
      alert("Failed to generate icons. Please try a different image.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Override Logic ---
  const handleOverrideClick = (id: string) => {
    setOverrideTargetId(id);
    overrideInputRef.current?.click();
  };

  const handleOverrideFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && overrideTargetId) {
      const newFile = e.target.files[0];
      const targetIconIndex = generatedIcons.findIndex(i => i.id === overrideTargetId);
      
      if (targetIconIndex === -1) return;
      
      const targetIcon = generatedIcons[targetIconIndex];
      
      try {
        const { blob, analysis } = await processImage(
          newFile, 
          targetIcon.originalDef, 
          brandColor,
          { scale: 1, padding: 0, keepOriginalBackground: true } // Assume override is perfect
        );

        const newUrl = URL.createObjectURL(blob);
        const updatedIcons = [...generatedIcons];
        updatedIcons[targetIconIndex] = {
          ...targetIcon,
          blob,
          url: newUrl,
          analysis
        };
        
        setGeneratedIcons(updatedIcons);
      } catch (err) {
        alert("Failed to process the replacement image.");
      }
    }
    if (overrideInputRef.current) overrideInputRef.current.value = '';
    setOverrideTargetId(null);
  };


  // --- Editor Logic ---
  const openEditor = (icon: GeneratedFile) => {
    if (icon.width === 0) return; 
    setEditingIcon(icon);
    setEditOptions({
      scale: 1, 
      padding: 0,
      backgroundColor: icon.originalDef.transparent ? '' : brandColor,
      keepOriginalBackground: keepOriginalBackground
    });
    
    // Smart default context
    if (icon.category === 'ios' || icon.category === 'pwa') setModalPreviewBg('context');
    else if (icon.category === 'windows') setModalPreviewBg('brand');
    else setModalPreviewBg('transparent');

    setModalViewMode(icon.width < 64 ? 'actual' : 'fit');
  };

  const closeEditor = () => {
    setEditingIcon(null);
    if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    setEditPreviewUrl(null);
  };

  useEffect(() => {
    let isCancelled = false;
    const updatePreview = async () => {
      // Logic to pick correct source file for live preview
      let sourceFile = file;
      
      // Determine variant source
      if (editingIcon?.variant === 'dark') {
          sourceFile = darkFile || file;
      }
      
      // Determine size source (Small vs Main)
      const isSmall = editingIcon ? editingIcon.width < 128 && editingIcon.width > 0 : false;
      
      if (isSmall) {
        if (editingIcon?.variant === 'dark' && smallDarkFile) {
            sourceFile = smallDarkFile;
        } else if (editingIcon?.variant === 'light' && smallFile) {
            sourceFile = smallFile;
        }
      }

      if (!editingIcon || !sourceFile) return;

      try {
        const { blob, analysis } = await processImage(
          sourceFile, 
          editingIcon.originalDef, 
          brandColor, 
          editOptions
        );

        if (!isCancelled) {
          if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
          setEditPreviewUrl(URL.createObjectURL(blob));
          setEditAnalysis(analysis.suggestions);
        }
      } catch (e) { console.error(e); }
    };

    const timer = setTimeout(updatePreview, 50); 
    return () => { isCancelled = true; clearTimeout(timer); };
  }, [editingIcon, editOptions, file, darkFile, smallFile, smallDarkFile, brandColor]);

  const saveEditedIcon = async () => {
    let sourceFile = file;

    // Determine variant source
    if (editingIcon?.variant === 'dark') {
        sourceFile = darkFile || file;
    }
    
    // Determine size source
    const isSmall = editingIcon ? editingIcon.width < 128 && editingIcon.width > 0 : false;
    
    if (isSmall) {
      if (editingIcon?.variant === 'dark' && smallDarkFile) {
          sourceFile = smallDarkFile;
      } else if (editingIcon?.variant === 'light' && smallFile) {
          sourceFile = smallFile;
      }
    }
    
    if (!editingIcon || !editPreviewUrl || !sourceFile) return;

    const { blob, analysis } = await processImage(
      sourceFile, 
      editingIcon.originalDef, 
      brandColor, 
      editOptions
    );

    const newUrl = URL.createObjectURL(blob);
    setGeneratedIcons(prev => prev.map(icon => {
      if (icon.id === editingIcon.id) {
        return { ...icon, blob, url: newUrl, analysis };
      }
      return icon;
    }));
    closeEditor();
  };


  // --- Zip Download ---
  const handleDownload = async () => {
    if (generatedIcons.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("icon-forge-assets");
    
    generatedIcons.forEach(icon => folder?.file(icon.name, icon.blob));
    
    // Manifest Generation
    // We strictly filter for PWA icons in the 'light' variant (standard).
    const pwaIcons = generatedIcons.filter(i => i.category === 'pwa' && i.variant === 'light');
    
    const manifestContent = {
      name: "My App",
      short_name: "App",
      start_url: "/",
      display: "standalone",
      background_color: brandColor,
      theme_color: brandColor,
      icons: pwaIcons.map(i => ({
          src: i.name, 
          sizes: `${i.width}x${i.height}`,
          type: "image/png",
          purpose: i.originalDef.maskable ? 'maskable' : 'any'
        }))
    };
    folder?.file("manifest.json", JSON.stringify(manifestContent, null, 2));

    const content = await zip.generateAsync({ type: "blob" });
    FileSaver.saveAs(content, "icon-forge-assets.zip");
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to Download
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleDownload();
      }
      // Ctrl/Cmd + O to Open File (Triggers main upload)
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        mainInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generatedIcons]); 


  // --- Helper Components ---
  
  // Categorize definitions for the dashboard list
  const groupedDefinitions = ICON_DEFINITIONS.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {} as Record<string, IconDefinition[]>);

  const getDashboardBgClass = () => {
    if (dashboardPreviewBg === 'white') return 'bg-white';
    if (dashboardPreviewBg === 'black') return 'bg-slate-950';
    return "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-800";
  };

  const categories: { id: IconCategory | 'all', labelKey: string, icon: React.ReactNode }[] = [
    { id: 'all', labelKey: 'all', icon: <Layers size={16} /> },
    { id: 'web', labelKey: 'web', icon: <Globe size={16} /> },
    { id: 'ios', labelKey: 'ios', icon: <Smartphone size={16} /> },
    { id: 'pwa', labelKey: 'pwa', icon: <Smartphone size={16} /> },
    { id: 'windows', labelKey: 'windows', icon: <Monitor size={16} /> },
    { id: 'macos', labelKey: 'macos', icon: <Monitor size={16} /> },
    { id: 'linux', labelKey: 'linux', icon: <Monitor size={16} /> },
    { id: 'social', labelKey: 'social', icon: <ImageIcon size={16} /> },
  ];

  const renderModalPreviewBackground = () => {
    const commonClasses = "flex items-center justify-center w-full h-full overflow-hidden absolute inset-0";
    switch (modalPreviewBg) {
      case 'light': return <div className={`${commonClasses} bg-slate-100`}></div>;
      case 'dark': return <div className={`${commonClasses} bg-slate-900`}></div>;
      case 'brand': return <div className={`${commonClasses}`} style={{ backgroundColor: brandColor }}></div>;
      case 'context':
        if (editingIcon?.category === 'ios') return <div className={`${commonClasses} bg-gradient-to-br from-blue-400 to-purple-500`}></div>;
        if (editingIcon?.category === 'web') return <div className={`${commonClasses} bg-slate-200`}></div>;
        return <div className={`${commonClasses} bg-slate-800`}></div>;
      case 'transparent':
      default: return <div className={`${commonClasses} bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-950`}></div>;
    }
  };

  const UploadZone = ({ 
    file, 
    preview, 
    type, 
    label, 
    icon, 
    height = "h-32",
    optional = false,
    inputRef
  }: { 
    file: File | null, 
    preview: string | null, 
    type: UploadType, 
    label: string, 
    icon: React.ReactNode, 
    height?: string,
    optional?: boolean,
    inputRef?: React.RefObject<HTMLInputElement>
  }) => (
    <div className="no-drag">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        {icon} {label} {optional && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-normal ml-auto">{t('optional')}</span>}
      </label>
      {!file ? (
        <label className={`flex flex-col items-center justify-center ${height} border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30 hover:bg-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group`}>
          <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 mb-2" />
          <span className="text-[10px] text-slate-400">{t('upload')}</span>
          <input type="file" ref={inputRef} className="hidden" onChange={(e) => handleFileChange(e, type)} />
        </label>
      ) : (
        <div className={`relative ${height} border border-slate-700 rounded-xl bg-slate-950 overflow-hidden group`}>
          <img src={preview!} className="w-full h-full object-contain p-2" alt={label} />
          <button onClick={() => clearFile(type)} className="absolute top-2 right-2 p-1 bg-slate-900/80 text-white rounded-full hover:bg-red-500/20 hover:text-red-400"><X size={12}/></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Native-like Title Bar */}
      <TitleBar onOpenSettings={() => setShowSettings(true)} />

      <div className="flex flex-1 overflow-hidden">
        <input type="file" ref={overrideInputRef} hidden accept="image/*" onChange={handleOverrideFileChange} />

        {/* --- SIDEBAR --- */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-6 border-b border-slate-800">
             <div className="flex items-center gap-2 mb-1">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">IF</div>
               <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{t('appName')}</h1>
             </div>
             <p className="text-xs text-slate-500 ml-10">{t('appDesc')}</p>
          </div>

          {/* Main Sources */}
          <div className="p-6 space-y-6 flex-1">
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">{t('mainSources')}</h3>
              <UploadZone 
                file={file} preview={previewUrl} type="main" 
                label={t('primary')} icon={<Sun size={14} className="text-amber-400" />} 
                inputRef={mainInputRef}
              />
              <UploadZone 
                file={darkFile} preview={darkPreviewUrl} type="dark" 
                label={t('darkMode')} icon={<Moon size={14} className="text-indigo-400" />} 
                optional 
                height="h-24"
              />
            </div>

            {/* Small Sources */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">{t('smallSizes')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <UploadZone 
                  file={smallFile} preview={smallPreviewUrl} type="small" 
                  label={t('lightSmall')} icon={<Minimize size={14} className="text-slate-400" />} 
                  optional height="h-20"
                />
                <UploadZone 
                  file={smallDarkFile} preview={smallDarkPreviewUrl} type="small-dark" 
                  label={t('darkSmall')} icon={<Minimize size={14} className="text-slate-500" />} 
                  optional height="h-20"
                />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4 pt-4 border-t border-slate-800 no-drag">
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">{t('brandColor')}</label>
                  <div className="flex gap-2 items-center">
                      <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded" />
                      <input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 w-24 font-mono text-slate-300 select-text" />
                  </div>
               </div>
               
               <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
                  <input type="checkbox" checked={keepOriginalBackground} onChange={(e) => setKeepOriginalBackground(e.target.checked)} className="mt-0.5 accent-indigo-500" />
                  <div>
                      <span className="block text-sm font-medium text-slate-300">{t('preserveBg')}</span>
                      <span className="block text-xs text-slate-500 mt-1">{t('preserveBgDesc')}</span>
                  </div>
               </label>
            </div>

          </div>

          <div className="p-6 border-t border-slate-800 bg-slate-900 sticky bottom-0 no-drag">
            <button 
              onClick={handleGenerate}
              disabled={!file || isGenerating}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${!file ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 active:scale-95'}`}
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
              {isGenerating ? t('processing') : t('generate')}
            </button>
          </div>
        </aside>

        {/* --- MAIN DASHBOARD --- */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950/50">
          
          {/* Top Bar */}
          <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0 no-drag">
              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
                  {categories.map(cat => (
                      <button 
                          key={cat.id} 
                          onClick={() => setActiveTab(cat.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${activeTab === cat.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                      >
                          {cat.icon} {t(cat.labelKey)}
                      </button>
                  ))}
              </div>

              <div className="flex items-center gap-4">
                  {/* Global Preview Bg Toggles */}
                  <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button onClick={() => setDashboardPreviewBg('checkered')} className={`p-1.5 rounded ${dashboardPreviewBg === 'checkered' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="Checkered"><Grid size={14}/></button>
                      <button onClick={() => setDashboardPreviewBg('white')} className={`p-1.5 rounded ${dashboardPreviewBg === 'white' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="White"><div className="w-3.5 h-3.5 bg-white rounded-sm border border-slate-300"></div></button>
                      <button onClick={() => setDashboardPreviewBg('black')} className={`p-1.5 rounded ${dashboardPreviewBg === 'black' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="Black"><div className="w-3.5 h-3.5 bg-black rounded-sm border border-slate-600"></div></button>
                  </div>
                  
                  <button 
                      onClick={handleDownload}
                      disabled={generatedIcons.length === 0}
                      className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${generatedIcons.length === 0 ? 'bg-slate-900 text-slate-600' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'}`}
                  >
                      <Download size={16}/> {t('download')}
                  </button>
              </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 no-drag">
              {generatedIcons.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                      <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-xl">
                          <ImageIcon size={48} className="opacity-20" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-400 mb-2">{t('ready')}</h3>
                      <p className="max-w-md text-center text-sm">{t('readyDesc')}</p>
                      <p className="mt-4 text-xs text-slate-500 font-mono">Ctrl+O to Open</p>
                  </div>
              ) : (
                  <div className="max-w-5xl mx-auto space-y-10 pb-20">
                      {Object.entries(groupedDefinitions).map(([category, defs]) => {
                          if (activeTab !== 'all' && activeTab !== category) return null;

                          return (
                              <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                                      {t(category)} Assets
                                  </h2>
                                  
                                  <div className="space-y-3">
                                      {defs.map((def) => {
                                          const lightIcon = generatedIcons.find(i => i.originalDef.name === def.name && i.variant === 'light');
                                          const darkIcon = generatedIcons.find(i => i.originalDef.name === def.name && i.variant === 'dark');
                                          
                                          if (!lightIcon) return null;

                                          return (
                                              <div key={def.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-6 hover:border-indigo-500/30 transition-colors group relative">
                                                  
                                                  {/* Info Column */}
                                                  <div className="w-64 shrink-0">
                                                      <h3 className="font-bold text-slate-200 text-sm truncate select-text" title={def.label || def.name}>{def.label || def.name}</h3>
                                                      <p className="text-xs text-slate-500 font-mono mt-1 select-text">{def.name}</p>
                                                      <div className="flex items-center gap-2 mt-2">
                                                          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{def.width > 0 ? `${def.width}x${def.height}` : 'Vector/Multi'}</span>
                                                          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700 uppercase">{def.format}</span>
                                                      </div>
                                                  </div>

                                                  {/* Preview Grid */}
                                                  <div className="flex-1 grid grid-cols-2 gap-4">
                                                      
                                                      {/* Light Mode Card */}
                                                      <div className="relative border border-slate-800 bg-slate-950 rounded-lg p-3 flex flex-col items-center group/card transition-all hover:bg-slate-900/50">
                                                          <div className="absolute top-2 left-2 text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Sun size={10}/> {t('light')}</div>
                                                          <div className={`w-20 h-20 mb-2 rounded flex items-center justify-center overflow-hidden border border-slate-800/50 ${getDashboardBgClass()}`}>
                                                              {lightIcon.url ? (
                                                                  <img src={lightIcon.url} className="max-w-full max-h-full object-contain" alt="light" />
                                                              ) : (
                                                                  <span className="text-xs text-slate-600">N/A</span>
                                                              )}
                                                          </div>
                                                          <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                              {lightIcon.width > 0 && <button onClick={() => openEditor(lightIcon)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title={t('editor')}><Edit2 size={12}/></button>}
                                                              <button onClick={() => handleOverrideClick(lightIcon.id)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title={t('replace')}><UploadCloud size={12}/></button>
                                                          </div>
                                                      </div>

                                                      {/* Dark Mode Card */}
                                                      {darkIcon ? (
                                                          <div className="relative border border-slate-800 bg-slate-950 rounded-lg p-3 flex flex-col items-center group/card transition-all hover:bg-slate-900/50">
                                                              <div className="absolute top-2 left-2 text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Moon size={10}/> {t('dark')}</div>
                                                              <div className={`w-20 h-20 mb-2 rounded flex items-center justify-center overflow-hidden border border-slate-800/50 ${getDashboardBgClass()}`}>
                                                                  <img src={darkIcon.url} className="max-w-full max-h-full object-contain" alt="dark" />
                                                              </div>
                                                              <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                                  {darkIcon.width > 0 && <button onClick={() => openEditor(darkIcon)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title={t('editor')}><Edit2 size={12}/></button>}
                                                                  <button onClick={() => handleOverrideClick(darkIcon.id)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title={t('replace')}><UploadCloud size={12}/></button>
                                                              </div>
                                                          </div>
                                                      ) : (
                                                          <div className="border border-slate-800 border-dashed rounded-lg flex items-center justify-center text-slate-700 text-xs">
                                                              No Dark Variant
                                                          </div>
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

        {/* --- SETTINGS MODAL --- */}
        {showSettings && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8 no-drag">
             <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                   <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={18} className="text-indigo-400"/> {t('settings')}</h3>
                   <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X size={18}/></button>
                </div>
                
                <div className="p-6 space-y-6">
                   {/* Language */}
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-3 block flex items-center gap-2"><Languages size={14}/> {t('language')}</label>
                      <div className="grid grid-cols-2 gap-2">
                          {[
                            {id: 'pt', label: 'Português (BR)'},
                            {id: 'en', label: 'English'},
                            {id: 'es', label: 'Español'},
                            {id: 'it', label: 'Italiano'},
                            {id: 'fr', label: 'Français'},
                            {id: 'de', label: 'Deutsch'},
                            {id: 'zh', label: '中文 (Chinese)'},
                            {id: 'ja', label: '日本語 (Japanese)'},
                          ].map((l) => (
                             <button 
                                key={l.id} 
                                onClick={() => setLang(l.id as AppLanguage)}
                                className={`px-4 py-2 text-sm rounded-lg border transition-all text-left ${lang === l.id ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                             >
                                {l.label}
                             </button>
                          ))}
                      </div>
                   </div>

                   {/* Theme */}
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-3 block flex items-center gap-2"><Palette size={14}/> {t('theme')}</label>
                      <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setTheme('light')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'bg-white border-indigo-500 text-slate-900' : 'bg-slate-100 border-slate-300 text-slate-500 opacity-50 hover:opacity-100'}`}>
                             <Sun size={20}/>
                             <span className="text-xs font-bold">{t('light')}</span>
                          </button>
                          <button onClick={() => setTheme('dark')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'bg-slate-900 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-50 hover:opacity-100'}`}>
                             <Moon size={20}/>
                             <span className="text-xs font-bold">{t('dark')}</span>
                          </button>
                          <button onClick={() => setTheme('design')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${theme === 'design' ? 'bg-zinc-950 border-pink-500 text-pink-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500 opacity-50 hover:opacity-100'}`}>
                             <Palette size={20}/>
                             <span className="text-xs font-bold">{t('design')}</span>
                          </button>
                      </div>
                   </div>
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                   <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">OK</button>
                </div>
             </div>
          </div>
        )}

        {/* --- EDITOR MODAL --- */}
        {editingIcon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8 no-drag">
              <div className="bg-slate-900 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden border border-slate-800">
                  
                  {/* Modal Sidebar */}
                  <div className="w-80 bg-slate-950 border-r border-slate-800 p-6 flex flex-col overflow-y-auto">
                      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                          <Edit2 size={18} className="text-indigo-400"/> {t('editor')}
                      </h3>
                      <p className="text-xs text-slate-500 mb-6">{editingIcon.name}</p>

                      {/* Controls */}
                      <div className="space-y-6 flex-1">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">{t('viewMode')}</label>
                              <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                                  <button onClick={() => setModalViewMode('fit')} className={`flex-1 py-1.5 text-xs font-medium rounded ${modalViewMode === 'fit' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>{t('fitScreen')}</button>
                                  <button onClick={() => setModalViewMode('actual')} className={`flex-1 py-1.5 text-xs font-medium rounded ${modalViewMode === 'actual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>{t('realSize')}</button>
                              </div>
                          </div>

                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">{t('previewBg')}</label>
                              <div className="grid grid-cols-5 gap-2">
                                  <button onClick={() => setModalPreviewBg('transparent')} title="Transparent" className={`aspect-square rounded border ${modalPreviewBg === 'transparent' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:border-slate-500'} bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-800`}></button>
                                  <button onClick={() => setModalPreviewBg('light')} title="Light Mode" className={`aspect-square rounded border ${modalPreviewBg === 'light' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:border-slate-500'} bg-slate-100`}></button>
                                  <button onClick={() => setModalPreviewBg('dark')} title="Dark Mode" className={`aspect-square rounded border ${modalPreviewBg === 'dark' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:border-slate-500'} bg-slate-900`}></button>
                                  <button onClick={() => setModalPreviewBg('brand')} title="Brand Color" className={`aspect-square rounded border ${modalPreviewBg === 'brand' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:border-slate-500'}`} style={{ backgroundColor: brandColor }}></button>
                                  <button onClick={() => setModalPreviewBg('context')} title="OS Context" className={`aspect-square rounded border ${modalPreviewBg === 'context' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:border-slate-500'} bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center`}><Monitor size={14}/></button>
                              </div>
                          </div>

                          <div className="pt-4 border-t border-slate-800">
                               <label className="text-xs font-bold text-slate-500 uppercase mb-3 block flex justify-between">
                                   Scale <span className="text-slate-300">{Math.round(editOptions.scale * 100)}%</span>
                               </label>
                               <input 
                                  type="range" min="0.5" max="1.5" step="0.05" 
                                  value={editOptions.scale} 
                                  onChange={(e) => setEditOptions({...editOptions, scale: parseFloat(e.target.value)})}
                                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                               />
                          </div>

                          <div>
                              <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                                  <input 
                                      type="checkbox" 
                                      checked={editOptions.keepOriginalBackground} 
                                      onChange={(e) => setEditOptions({...editOptions, keepOriginalBackground: e.target.checked})}
                                      className="accent-indigo-500"
                                  />
                                  {t('preserveBg')}
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-300">
                                  <input 
                                      type="checkbox" 
                                      checked={editOptions.backgroundColor === ''} 
                                      onChange={(e) => setEditOptions({...editOptions, backgroundColor: e.target.checked ? '' : brandColor})}
                                      className="accent-indigo-500"
                                  />
                                  Force Transparent Output
                              </label>
                          </div>
                      </div>

                      {/* Analysis Panel */}
                      <div className="mt-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><Eye size={12}/> {t('analysis')}</h4>
                          {editAnalysis.length > 0 ? (
                              <ul className="space-y-2">
                                  {editAnalysis.map((msg, i) => (
                                      <li key={i} className="text-xs text-amber-400 flex items-start gap-2">
                                          <AlertTriangle size={12} className="shrink-0 mt-0.5"/> {msg}
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <p className="text-xs text-emerald-400 flex items-center gap-2"><Check size={12}/> {t('goodVisibility')}</p>
                          )}
                      </div>
                      
                      <div className="mt-6 flex gap-3">
                          <button onClick={closeEditor} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium">{t('cancel')}</button>
                          <button onClick={saveEditedIcon} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium shadow-lg shadow-indigo-500/20">{t('save')}</button>
                      </div>
                  </div>

                  {/* Modal Stage */}
                  <div className="flex-1 relative bg-slate-900 overflow-auto flex items-center justify-center p-10">
                      <div className={`relative shadow-2xl transition-all duration-300 ${modalViewMode === 'fit' ? 'w-full h-full' : ''}`} style={{ width: modalViewMode === 'actual' ? editingIcon.width : undefined, height: modalViewMode === 'actual' ? editingIcon.height : undefined }}>
                           {/* Dynamic Background Layer */}
                           {renderModalPreviewBackground()}
                           
                           {/* Image Layer */}
                           <div className="absolute inset-0 flex items-center justify-center z-10">
                              {editPreviewUrl && (
                                  <img 
                                      src={editPreviewUrl} 
                                      className={`object-contain transition-all duration-200 ${modalViewMode === 'fit' ? 'max-w-[80%] max-h-[80%]' : ''}`} 
                                      style={{ width: modalViewMode === 'actual' ? '100%' : undefined, height: modalViewMode === 'actual' ? '100%' : undefined }}
                                      alt="Preview" 
                                  />
                              )}
                           </div>

                           {/* Context Overlays (Mockups) for specific categories */}
                           {modalPreviewBg === 'context' && editingIcon.category === 'ios' && (
                              <div className="absolute inset-0 pointer-events-none border-[30px] border-black rounded-[40px] opacity-20"></div> // Simple phone frame mock
                           )}
                      </div>
                  </div>

              </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;