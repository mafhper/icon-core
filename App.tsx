import React, { useState, useEffect } from 'react';
import { Download, Check, RefreshCw, X, Moon, Sun, Plus, Zap, Filter, Grid3X3, Hammer, Shield, Sparkles, Share2, Info, Ban, Settings, Monitor, Type, Scaling, Star } from 'lucide-react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { GeneratedFile, IconVariant, AppLanguage, AppTheme } from './types';
import { processImage, getDominantColor } from './utils/imageProcessor';
import { generateIco } from './utils/icoGenerator';

const TRANSLATIONS: Record<AppLanguage, any> = {
  pt: {
    setupTitle: "Icon Forge",
    setupDesc: "Configure seus ativos para renderização local de alta fidelidade.",
    universal: "Ativo Master",
    overrides: "Overrides Estratégicos",
    generate: "Gerar Ativos",
    processing: "Processando...",
    ready: "Ativos Prontos",
    download: "Exportar Pack",
    tabStudio: "Estúdio",
    tabForge: "Explorar",
    safeZones: "Safe Zones",
    manifest: "PWA Manifest",
    faviconOverride: "Favicon Override",
    socialBG: "Background Social",
    optional: "Opcional",
    resHint: "Sugerido: ",
    transparent: "Transparente",
    masterBG: "Master BG",
    settings: "Configurações",
    language: "Idioma",
    contextView: "Visualização em Contexto",
    browserLight: "Browser Claro",
    browserDark: "Browser Escuro",
    mobileHome: "Home Screen",
    dock: "Dock / Taskbar",
    dropMaster: "Arraste o Arquivo Master",
    remove: "Remover",
    readyForForge: "Pronto para Gerar",
    readyDesc: "Adicione variações ou use o Ativo Master",
    assetsComposed: "Ativos Compostos",
    assetsDesc: "Estrutura Otimizada & Pronta",
    appName: "Nome do App",
    newTab: "Nova Guia",
    lightIcon: "Ícone Light",
    darkIcon: "Ícone Dark",
    favLight: "Favicon Light",
    favDark: "Favicon Dark",
    socialCardBg: "Social Card BG",
    labelLogo: "LOGOTIPO",
    labelSocial: "SOCIAL",
    labelFavicon: "FAVICON",
    assets: "ATIVOS",
    vector: "VETOR",
    appInfo: "Informações do App",
    lblName: "Nome",
    lblShortName: "Nome Curto",
    lblDesc: "Descrição",
    lblStartUrl: "URL Inicial",
    lblPadding: "Margem de Segurança",
    lblDefaultTheme: "Tema Padrão",
    defLight: "Light (Claro)",
    defDark: "Dark (Escuro)"
  },
  en: {
    setupTitle: "Icon Forge",
    setupDesc: "Setup your assets for local high-fidelity rendering.",
    universal: "Master Asset",
    overrides: "Strategic Overrides",
    generate: "Generate Assets",
    processing: "Processing...",
    ready: "Assets Ready",
    download: "Export Pack",
    tabStudio: "Studio",
    tabForge: "Explore",
    safeZones: "Safe Zones",
    manifest: "PWA Manifest",
    faviconOverride: "Favicon Override",
    socialBG: "Social Background",
    optional: "Optional",
    resHint: "Suggested: ",
    transparent: "Transparent",
    masterBG: "Master BG",
    settings: "Settings",
    language: "Language",
    contextView: "Context View",
    browserLight: "Browser Light",
    browserDark: "Browser Dark",
    mobileHome: "Home Screen",
    dock: "Dock / Taskbar",
    dropMaster: "Drop Master File",
    remove: "Remove",
    readyForForge: "Ready to Generate",
    readyDesc: "Add variations or use Master Asset",
    assetsComposed: "Assets Composed",
    assetsDesc: "Structure Optimized & Ready",
    appName: "App Name",
    newTab: "New Tab",
    lightIcon: "Light Icon",
    darkIcon: "Dark Icon",
    favLight: "Favicon Light",
    favDark: "Favicon Dark",
    socialCardBg: "Social Card BG",
    labelLogo: "LOGO",
    labelSocial: "SOCIAL",
    labelFavicon: "FAVICON",
    assets: "ASSETS",
    vector: "VECTOR",
    appInfo: "App Info",
    lblName: "Name",
    lblShortName: "Short Name",
    lblDesc: "Description",
    lblStartUrl: "Start URL",
    lblPadding: "Safety Margin",
    lblDefaultTheme: "Default Theme",
    defLight: "Light",
    defDark: "Dark"
  },
  es: {
    setupTitle: "Icon Forge",
    setupDesc: "Configure sus activos para renderizado local de alta fidelidad.",
    universal: "Activo Maestro",
    overrides: "Anulaciones Estratégicas",
    generate: "Generar Activos",
    processing: "Procesando...",
    ready: "Activos Listos",
    download: "Exportar Pack",
    tabStudio: "Estudio",
    tabForge: "Explorar",
    safeZones: "Zonas Seguras",
    manifest: "PWA Manifest",
    faviconOverride: "Favicon Override",
    socialBG: "Fondo Social",
    optional: "Opcional",
    resHint: "Sugerido: ",
    transparent: "Transparente",
    masterBG: "Fondo Maestro",
    settings: "Ajustes",
    language: "Idioma",
    contextView: "Vista de Contexto",
    browserLight: "Navegador Claro",
    browserDark: "Navegador Oscuro",
    mobileHome: "Pantalla de Inicio",
    dock: "Dock / Barra de Tareas",
    dropMaster: "Soltar Archivo Maestro",
    remove: "Eliminar",
    readyForForge: "Listo para Generar",
    readyDesc: "Añade variaciones o usa el Activo Maestro",
    assetsComposed: "Activos Compuestos",
    assetsDesc: "Estructura Optimizada y Lista",
    appName: "Nombre App",
    newTab: "Nueva Pestaña",
    lightIcon: "Icono Light",
    darkIcon: "Icono Dark",
    favLight: "Favicon Light",
    favDark: "Favicon Dark",
    socialCardBg: "Fondo Tarjeta Social",
    labelLogo: "LOGOTIPO",
    labelSocial: "SOCIAL",
    labelFavicon: "FAVICON",
    assets: "ACTIVOS",
    vector: "VECTOR",
    appInfo: "Info de la App",
    lblName: "Nombre",
    lblShortName: "Nombre Corto",
    lblDesc: "Descripción",
    lblStartUrl: "URL Inicial",
    lblPadding: "Margen de Seguridad",
    lblDefaultTheme: "Tema Predeterminado",
    defLight: "Light (Claro)",
    defDark: "Dark (Oscuro)"
  },
  // Fallbacks
  it: { setupTitle: "Icon Forge", dropMaster: "Drop Master File", remove: "Remove", vector: "VECTOR", appName: "App Name", lblPadding: "Safety Margin" },
  fr: { setupTitle: "Icon Forge", dropMaster: "Drop Master File", remove: "Remove", vector: "VECTOR", appName: "App Name", lblPadding: "Safety Margin" },
  de: { setupTitle: "Icon Forge", dropMaster: "Drop Master File", remove: "Remove", vector: "VECTOR", appName: "App Name", lblPadding: "Safety Margin" },
  zh: { setupTitle: "Icon Forge", dropMaster: "Drop Master File", remove: "Remove", vector: "VECTOR", appName: "App Name", lblPadding: "Safety Margin" },
  ja: { setupTitle: "Icon Forge", dropMaster: "Drop Master File", remove: "Remove", vector: "VECTOR", appName: "App Name", lblPadding: "Safety Margin" }
};

// Helper to get translation safely
const getT = (lang: AppLanguage, key: string) => {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en']?.[key] || key;
};

const SafeZoneOverlay = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <div className="absolute inset-[15%] border border-dashed border-studio-accent/30 rounded-full"></div>
      <div className="absolute inset-[15%] border border-dashed border-studio-accent/30 rounded-[15%]"></div>
      <div className="absolute top-1/2 left-0 w-full h-px bg-studio-accent/10"></div>
      <div className="absolute left-1/2 top-0 w-px h-full bg-studio-accent/10"></div>
    </div>
  );
};

const ContextPreview = ({ icons, lang, appName, defaultTheme }: { icons: GeneratedFile[], lang: AppLanguage, appName: string, defaultTheme: 'light' | 'dark' }) => {
  // Find the most appropriate icon based on size and the selected default theme
  const icon = icons.find(i => i.name.includes('192') && i.name.includes(defaultTheme)) || icons.find(i => i.name.includes('192')) || icons[0];
  
  // Favicon: Try to find .ico first, then PNG
  const favicon = icons.find(i => i.typeLabel === 'favicon' && i.name.includes(defaultTheme) && i.name.endsWith('.ico')) || icons.find(i => i.typeLabel === 'favicon' && i.name.endsWith('.ico')) || icons[0];
  
  const t = (k: string) => getT(lang, k);
  
  if (!icon) return null;

  return (
    <div className="space-y-6 mb-16 animate-spring">
      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-3 whitespace-nowrap bg-studio-bg pr-4">
         <Monitor size={16} className="text-purple-500" />
         {t('contextView')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* Browser Tab Light */}
         <div className="bg-white text-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-200 hover:scale-[1.02] transition-transform duration-500">
            <div className="bg-gray-100 px-3 py-2 flex items-center gap-2 border-b border-gray-200">
               <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
               </div>
            </div>
            <div className="p-4 bg-gray-50 border-b border-gray-200">
               <div className="bg-white rounded-t-lg px-4 py-2 text-xs font-medium flex items-center gap-2 shadow-sm border-t border-x border-gray-200 w-fit -mb-4 relative z-10">
                  <img src={favicon?.url} className="w-4 h-4 object-contain" />
                  <span className="opacity-80">{t('newTab')}</span>
                  <X size={10} className="ml-2 opacity-40"/>
               </div>
            </div>
            <div className="h-24 bg-white flex items-center justify-center opacity-5">
              <Sparkles size={48} />
            </div>
            <div className="p-3 text-[10px] text-center uppercase font-black text-gray-400 tracking-widest">{t('browserLight')}</div>
         </div>

         {/* Browser Tab Dark */}
         <div className="bg-gray-900 text-white rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:scale-[1.02] transition-transform duration-500">
            <div className="bg-gray-800 px-3 py-2 flex items-center gap-2 border-b border-gray-700">
               <div className="flex gap-1.5 opacity-50">
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
               </div>
            </div>
            <div className="p-4 bg-gray-900 border-b border-gray-800">
               <div className="bg-gray-800 rounded-t-lg px-4 py-2 text-xs font-medium flex items-center gap-2 shadow-sm w-fit -mb-4 relative z-10">
                  <img src={favicon?.url} className="w-4 h-4 object-contain" />
                  <span className="opacity-80">{t('newTab')}</span>
                  <X size={10} className="ml-2 opacity-40"/>
               </div>
            </div>
            <div className="h-24 bg-gray-950 flex items-center justify-center opacity-5">
               <Sparkles size={48} />
            </div>
             <div className="p-3 text-[10px] text-center uppercase font-black text-gray-600 tracking-widest">{t('browserDark')}</div>
         </div>

         {/* Mobile Icon */}
         <div className="relative overflow-hidden rounded-xl shadow-lg aspect-video md:aspect-auto flex flex-col hover:scale-[1.02] transition-transform duration-500 group">
            <div className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-6 relative">
               <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
               <div className="flex flex-col items-center gap-2 relative z-10">
                  <img src={icon.url} className="w-14 h-14 rounded-[1.2rem] shadow-2xl bg-white" style={{boxShadow: '0 10px 20px rgba(0,0,0,0.3)'}} />
                  <span className="text-[10px] font-medium text-white drop-shadow-md">{appName || t('appName')}</span>
               </div>
            </div>
            <div className="p-3 bg-white dark:bg-black text-[10px] text-center uppercase font-black text-gray-400 tracking-widest border-t border-studio-border">{t('mobileHome')}</div>
         </div>
         
         {/* Dock/App Store */}
          <div className="relative overflow-hidden rounded-xl shadow-lg border border-studio-border bg-studio-bg flex flex-col hover:scale-[1.02] transition-transform duration-500">
            <div className="flex-1 flex items-center justify-center p-6 bg-studio-bg relative">
               <div className="absolute inset-0 bg-studio-accent/5"></div>
               <div className="flex items-end gap-3 p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20"></div>
                  <img src={icon.url} className="w-12 h-12 rounded-[0.8rem] shadow-lg transition-transform hover:-translate-y-2 duration-300 bg-black/20" />
                  <div className="w-10 h-10 rounded-xl bg-green-500/20"></div>
               </div>
            </div>
            <div className="p-3 bg-studio-card text-[10px] text-center uppercase font-black text-studio-sub tracking-widest border-t border-studio-border">{t('dock')}</div>
         </div>
      </div>
    </div>
  )
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sources' | 'forge' | 'settings'>('sources');
  const [lang, setLang] = useState<AppLanguage>('pt'); 
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // New States
  const [defaultTheme, setDefaultTheme] = useState<'light' | 'dark'>('light');
  const [padding, setPadding] = useState(0); 

  // App Metadata State
  const [appInfo, setAppInfo] = useState({
    name: 'My App',
    shortName: 'App',
    description: 'My awesome application built with Icon Forge',
    startUrl: '/'
  });

  const [files, setFiles] = useState<Record<string, { file: File | Blob | null, preview: string | null }>>({
    universal: { file: null, preview: null },
    light: { file: null, preview: null },
    dark: { file: null, preview: null },
    faviconLight: { file: null, preview: null },
    faviconDark: { file: null, preview: null },
    socialBG: { file: null, preview: null }
  });

  const [generatedIcons, setGeneratedIcons] = useState<GeneratedFile[]>([]);
  const [brandColor, setBrandColor] = useState('#a855f7');
  const [brandColorDark, setBrandColorDark] = useState('#1e1e1e');
  const [isBgTransparent, setIsBgTransparent] = useState(true);

  const t = (key: string) => getT(lang, key);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const onFileSelect = (file: File, type: string) => {
    const url = URL.createObjectURL(file);
    setFiles(prev => ({ ...prev, [type]: { file, preview: url } }));
    if (type === 'universal') {
      const img = new Image();
      img.onload = () => setBrandColor(getDominantColor(img));
      img.src = url;
    }
  };

  const clearFile = (type: string) => {
    setFiles(prev => ({ ...prev, [type]: { file: null, preview: null } }));
  };

  const generateSet = async () => {
    if (!files.universal.file) return;
    setIsGenerating(true);
    
    const results: GeneratedFile[] = [];
    
    // --- Source Deductions based on User Rules ---
    // Rule 1: Master file is ALWAYS used as the 'Default' file (assets/logo.svg)
    // Rule 2: If Master + Light provided -> Master deduced as Dark.
    // Rule 3: If Master + Dark provided -> Master deduced as Light.
    
    const master = files.universal.file;
    const light = files.light.file;
    const dark = files.dark.file;

    // Semantic Sources (Who represents what theme)
    let sourceForLight: File | Blob = master;
    let sourceForDark: File | Blob = master;

    if (light && !dark) {
       // User sent Master + Light. Deduce Master is Dark.
       sourceForLight = light;
       sourceForDark = master;
    } else if (!light && dark) {
       // User sent Master + Dark. Deduce Master is Light.
       sourceForLight = master;
       sourceForDark = dark;
    } else if (light && dark) {
       // User sent all. Use specifics.
       sourceForLight = light;
       sourceForDark = dark;
    } 
    // If only Master, both stay as Master.

    // Favicon Sources
    const favLight = files.faviconLight.file || sourceForLight;
    const favDark = files.faviconDark.file || sourceForDark;


    // --- 1. Root Assets Generation (assets/logo) ---
    // "Use Master as Default" -> assets/logo.svg = Master
    // "Add other as secondary" -> assets/logo-variant.svg
    const tasks: any[] = [];

    // Default Logo (from Master)
    const masterExt = master.type === 'image/svg+xml' ? 'svg' : 'png';
    tasks.push({
       name: `assets/logo.${masterExt}`,
       source: master,
       width: 0, height: 0, variant: 'any', type: 'logo', format: masterExt, transparent: true
    });

    // Secondary Logos
    if (light && light !== master) {
       const ext = light.type === 'image/svg+xml' ? 'svg' : 'png';
       tasks.push({
          name: `assets/logo-light.${ext}`,
          source: light,
          width: 0, height: 0, variant: 'light', type: 'logo', format: ext, transparent: true
       });
    }
    if (dark && dark !== master) {
       const ext = dark.type === 'image/svg+xml' ? 'svg' : 'png';
       tasks.push({
          name: `assets/logo-dark.${ext}`,
          source: dark,
          width: 0, height: 0, variant: 'dark', type: 'logo', format: ext, transparent: true
       });
    }

    // --- 2. Icons Folder Structure (Semantic) ---
    // Uses sourceForLight and sourceForDark to populate icons/light/* and icons/dark/*
    const variants: ('light' | 'dark')[] = ['light', 'dark'];
    
    variants.forEach(variant => {
      const prefix = `icons/${variant}`;
      const sourceLogo = variant === 'light' ? sourceForLight : sourceForDark;
      const sourceFav = variant === 'light' ? favLight : favDark;
      const isOpaque = !isBgTransparent;

      // Favicons (PNG versions)
      [16, 32, 48].forEach(size => {
         tasks.push({
            name: `${prefix}/favicon-${size}x${size}.png`,
            source: sourceFav,
            width: size, height: size, variant, type: 'favicon', format: 'png', transparent: true
         });
      });

      // Apple Touch Icons
      [180, 152, 120].forEach(size => {
        const fName = size === 180 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}x${size}.png`;
        tasks.push({
           name: `${prefix}/${fName}`,
           source: sourceLogo,
           width: size, height: size, variant, type: 'logo', format: 'png', transparent: false // Apple icons opaque
        });
      });

      // PWA Standard
      [192, 512].forEach(size => {
        tasks.push({
           name: `${prefix}/pwa-${size}x${size}.png`,
           source: sourceLogo,
           width: size, height: size, variant, type: 'logo', format: 'png', transparent: !isOpaque
        });
      });

      // PWA Maskable
      [192, 512].forEach(size => {
        tasks.push({
           name: `${prefix}/pwa-maskable-${size}x${size}.png`,
           source: sourceLogo,
           width: size, height: size, variant, type: 'logo', format: 'png', transparent: false,
           isMaskable: true
        });
      });
    });

    // --- 3. Social ---
    const socialSource = files.universal.file;
    tasks.push({ name: 'og-image.png', source: socialSource, width: 1200, height: 630, format: 'png', variant: 'light', type: 'social', transparent: false });
    tasks.push({ name: 'twitter-image.png', source: socialSource, width: 1200, height: 600, format: 'png', variant: 'light', type: 'social', transparent: false });

    try {
      // Execution
      const processingPromises = tasks.map(async def => {
        if (!def.source) return;

        let bgColor = def.variant === 'light' ? brandColor : brandColorDark;
        if (def.variant === 'any') bgColor = brandColor; // Default for master if undefined

        // SVG Pass-through
        if (def.format === 'svg' && def.source.type === 'image/svg+xml') {
           results.push({
             id: def.name, name: def.name, blob: def.source, url: URL.createObjectURL(def.source),
             size: def.source.size, category: 'web', variant: def.variant, width: 0, height: 0,
             typeLabel: def.type, originalDef: def
           });
           return;
        }

        let effectivePadding = padding;
        if (def.isMaskable) effectivePadding = Math.max(padding, 0.2); 

        const { blob, analysis } = await processImage(
          def.source, 
          { ...def, category: 'web' } as any,
          bgColor,
          def.type === 'social' ? files.socialBG.file : null,
          { scale: 1, padding: effectivePadding }
        );

        results.push({
          id: def.name, name: def.name, blob, url: URL.createObjectURL(blob),
          size: blob.size, category: 'web', variant: def.variant as any,
          width: def.width, height: def.height, originalDef: def as any, analysis, typeLabel: def.type as any
        });
      });

      // ICO Processing
      const favIcoTasks = variants.map(async variant => {
         const prefix = `icons/${variant}`;
         const sourceFav = variant === 'light' ? favLight : favDark;
         if (!sourceFav) return;

         const f16 = await processImage(sourceFav, { width: 16, height: 16, type: 'favicon', transparent: true, format: 'png' } as any, brandColor, null, { scale: 1, padding });
         const f32 = await processImage(sourceFav, { width: 32, height: 32, type: 'favicon', transparent: true, format: 'png' } as any, brandColor, null, { scale: 1, padding });

         const icoBlob = await generateIco([
            { width: 16, height: 16, blob: f16.blob },
            { width: 32, height: 32, blob: f32.blob }
         ]);

         results.push({
            id: `${prefix}/favicon.ico`,
            name: `${prefix}/favicon.ico`,
            blob: icoBlob,
            url: URL.createObjectURL(icoBlob),
            size: icoBlob.size, category: 'web', variant, width: 32, height: 32, typeLabel: 'favicon', originalDef: {} as any
         });

         if (sourceFav.type === 'image/svg+xml') {
            results.push({
               id: `${prefix}/favicon.svg`,
               name: `${prefix}/favicon.svg`,
               blob: sourceFav,
               url: URL.createObjectURL(sourceFav),
               size: sourceFav.size, category: 'web', variant, width: 0, height: 0, typeLabel: 'favicon', originalDef: {} as any
            });
         }
      });

      await Promise.all([...processingPromises, ...favIcoTasks]);
      setGeneratedIcons(results);
      setActiveTab('forge');
    } catch (e) {
      console.error("Forge failed:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const getManifestObject = () => {
    // Manifest points to 'light' icons by default as per requirements
    // Assumes icons/light structure
    
    return {
      name: appInfo.name,
      short_name: appInfo.shortName,
      description: appInfo.description,
      start_url: appInfo.startUrl,
      display: "standalone",
      background_color: brandColor,
      theme_color: brandColor,
      orientation: "any",
      icons: [
        {
          src: "icons/light/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "icons/light/pwa-maskable-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable"
        },
        {
          src: "icons/light/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "icons/light/pwa-maskable-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ]
    };
  };

  // Uses translations for labels
  const uploadSlots = [
    { id: 'light', icon: <Sun size={14}/>, labelKey: 'lightIcon', res: '1024x1024' },
    { id: 'dark', icon: <Moon size={14}/>, labelKey: 'darkIcon', res: '1024x1024' },
    { id: 'faviconLight', icon: <Grid3X3 size={14}/>, labelKey: 'favLight', res: '512x512' },
    { id: 'faviconDark', icon: <Grid3X3 size={14}/>, labelKey: 'favDark', res: '512x512' },
    { id: 'socialBG', icon: <Share2 size={14}/>, labelKey: 'socialCardBg', res: '1200x630' }
  ];

  const getSectionLabel = (type: string) => {
    if (type === 'logo') return t('labelLogo');
    if (type === 'social') return t('labelSocial');
    if (type === 'favicon') return t('labelFavicon');
    return t('assets');
  };

  return (
    <div className="flex flex-col md:h-screen bg-studio-bg text-studio-text relative selection:bg-studio-accent/30 overflow-x-hidden">
      <div className="fixed inset-0 blueprint-grid pointer-events-none z-0"></div>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setShowSettings(false)}>
           <div className="bg-studio-card border border-studio-border p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative animate-spring max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 p-2 text-studio-sub hover:text-studio-text"><X size={20}/></button>
              <h2 className="text-xl font-black uppercase tracking-wide mb-8 flex items-center gap-3"><Settings className="text-studio-accent"/> {t('settings')}</h2>
              
              <div className="space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-studio-sub tracking-widest flex items-center gap-2"><Type size={12}/> {t('appInfo')}</label>
                    <div className="space-y-3">
                       <div>
                          <label className="text-[9px] font-bold text-studio-sub uppercase mb-1 block">{t('lblName')}</label>
                          <input type="text" value={appInfo.name} onChange={e => setAppInfo({...appInfo, name: e.target.value})} className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-xs text-studio-text focus:border-studio-accent outline-none transition-colors" />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[9px] font-bold text-studio-sub uppercase mb-1 block">{t('lblShortName')}</label>
                            <input type="text" value={appInfo.shortName} onChange={e => setAppInfo({...appInfo, shortName: e.target.value})} className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-xs text-studio-text focus:border-studio-accent outline-none transition-colors" />
                         </div>
                         <div>
                            <label className="text-[9px] font-bold text-studio-sub uppercase mb-1 block">{t('lblStartUrl')}</label>
                            <input type="text" value={appInfo.startUrl} onChange={e => setAppInfo({...appInfo, startUrl: e.target.value})} className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-xs text-studio-text focus:border-studio-accent outline-none transition-colors" />
                         </div>
                       </div>
                       <div>
                          <label className="text-[9px] font-bold text-studio-sub uppercase mb-1 block">{t('lblDesc')}</label>
                          <textarea value={appInfo.description} onChange={e => setAppInfo({...appInfo, description: e.target.value})} className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-xs text-studio-text focus:border-studio-accent outline-none transition-colors h-20 resize-none" />
                       </div>
                    </div>
                 </div>

                 <div className="h-px bg-studio-border"></div>

                 {/* Default Theme Selector */}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-studio-sub tracking-widest flex items-center gap-2"><Star size={12}/> {t('lblDefaultTheme')}</label>
                    <div className="flex gap-2">
                       <button onClick={() => setDefaultTheme('light')} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${defaultTheme === 'light' ? 'bg-white text-black border border-white' : 'bg-studio-bg border border-studio-border text-studio-sub'}`}>
                          <Sun size={14}/> {t('defLight')}
                       </button>
                       <button onClick={() => setDefaultTheme('dark')} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${defaultTheme === 'dark' ? 'bg-gray-900 text-white border border-gray-900' : 'bg-studio-bg border border-studio-border text-studio-sub'}`}>
                          <Moon size={14}/> {t('defDark')}
                       </button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-studio-sub tracking-widest">{t('language')}</label>
                    <div className="grid grid-cols-3 gap-2">
                       {(['pt', 'en', 'es'] as AppLanguage[]).map(l => (
                          <button key={l} onClick={() => setLang(l)} className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${lang === l ? 'bg-studio-accent text-black' : 'bg-studio-bg border border-studio-border text-studio-sub hover:border-studio-accent'}`}>
                             {l === 'pt' ? 'Português' : l === 'en' ? 'English' : 'Español'}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      <header className="sticky top-0 h-16 shrink-0 border-b border-studio-border bg-studio-bg/50 backdrop-blur-xl z-50 flex items-center justify-between px-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-studio-accent rounded-2xl flex items-center justify-center shadow-[0_0_20px_var(--accent-glow)]"><Hammer size={20} className="text-black" strokeWidth={3} /></div>
             <div className="flex flex-col"><span className="text-[10px] font-black tracking-widest uppercase">Icon Forge</span><span className="text-[8px] text-studio-sub uppercase font-bold">v7.2</span></div>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <button onClick={() => setShowSettings(true)} className="p-2 text-studio-sub hover:text-studio-accent transition-colors"><Settings size={20} /></button>
             <div className="flex items-center gap-1">
               {['light', 'dark', 'tender'].map(m => (
                 <button key={m} onClick={() => setTheme(m as any)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${theme === m ? 'bg-studio-accent text-black' : 'text-studio-sub hover:bg-studio-border'}`}>{m}</button>
               ))}
             </div>
          </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row relative z-10 md:overflow-hidden">
        
        {/* ASIDE: SOURCES */}
        <aside className={`md:w-[480px] shrink-0 md:border-r border-studio-border md:overflow-y-auto no-scrollbar ${activeTab === 'sources' ? 'block' : 'hidden md:block'}`}>
           <div className="p-8 md:p-10 space-y-10 pb-40 md:pb-12 animate-spring">
              <div className="space-y-2">
                 <p className="text-sm text-studio-sub font-medium">{t('setupDesc')}</p>
              </div>

              {/* Master Slot */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-studio-accent flex items-center gap-2"><Sparkles size={12}/> {t('universal')}</label>
                    <span className="text-[9px] font-mono text-studio-sub opacity-50">{t('resHint')}1024x1024</span>
                 </div>
                 <div className="aspect-square glass-card rounded-[2.5rem] relative overflow-hidden group shadow-2xl border-studio-accent/20">
                    {!files.universal.preview ? (
                      <button onClick={() => document.getElementById('up-master')?.click()} className="w-full h-full flex flex-col items-center justify-center gap-4 hover:bg-studio-accent/5 transition-all">
                         <div className="p-6 bg-studio-bg/50 rounded-3xl border border-studio-border group-hover:scale-110 transition-transform"><Plus size={32} className="text-studio-sub group-hover:text-studio-accent" /></div>
                         <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{t('dropMaster')}</span>
                      </button>
                    ) : (
                      <div className="w-full h-full p-12 flex items-center justify-center relative bg-checkered rounded-[2.5rem]">
                         <SafeZoneOverlay show={showSafeZones} />
                         <img src={files.universal.preview} className="max-w-full max-h-full object-contain drop-shadow-2xl z-20 relative" />
                         <button onClick={() => clearFile('universal')} className="absolute top-6 right-6 p-2 bg-red-500/10 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-40"><X size={20}/></button>
                      </div>
                    )}
                    <input id="up-master" type="file" hidden accept="image/*" onChange={e => e.target.files?.[0] && onFileSelect(e.target.files[0], 'universal')} />
                 </div>
              </div>

              {/* Overrides Slots */}
              <div className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2"><Filter size={14} className="text-studio-accent"/> {t('overrides')}</h3>
                 <div className="grid grid-cols-2 gap-4">
                    {uploadSlots.map(slot => (
                      <div key={slot.id} className="flex flex-col gap-2">
                         <div className="flex items-center justify-between gap-2 px-1">
                            <span className="text-[8px] font-black text-studio-sub uppercase tracking-widest truncate">{t(slot.labelKey)}</span>
                            <div className="group relative">
                               <Info size={10} className="text-studio-sub/40 hover:text-studio-accent cursor-help" />
                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 p-2 bg-studio-card border border-studio-border rounded-lg text-[7px] font-bold text-center uppercase opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                  {slot.res} (Sug)
                               </div>
                            </div>
                         </div>
                         <button onClick={() => document.getElementById(`up-${slot.id}`)?.click()} className={`h-28 glass-card rounded-2xl flex items-center justify-center relative overflow-hidden group transition-all ${files[slot.id].preview ? 'border-emerald-500/40 bg-emerald-500/5' : 'hover:bg-studio-accent/5'}`}>
                            {files[slot.id].preview ? (
                               <img src={files[slot.id].preview!} className="w-full h-full object-cover" />
                            ) : (
                               <div className="p-3 bg-studio-bg rounded-xl border border-studio-border group-hover:scale-110 transition-transform">{slot.icon}</div>
                            )}
                            {files[slot.id].preview && (
                               <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 z-10 bg-black/50 opacity-0 group-hover:opacity-100 transition-all">
                                  <button onClick={(e) => { e.stopPropagation(); clearFile(slot.id); }} className="text-[8px] font-black uppercase text-white bg-red-500 px-3 py-2 rounded-xl shadow-xl hover:scale-105 transition-transform">{t('remove')}</button>
                                </div>
                            )}
                         </button>
                         <input id={`up-${slot.id}`} type="file" hidden accept="image/*" onChange={e => e.target.files?.[0] && onFileSelect(e.target.files[0], slot.id)} />
                      </div>
                    ))}
                 </div>
              </div>

              {/* Adjustments */}
              <div className="glass-card rounded-[2.5rem] p-8 space-y-6 shadow-2xl border-studio-border/30">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="flex flex-col gap-3">
                       <span className="text-[10px] font-black uppercase text-studio-sub tracking-widest">{t('safeZones')}</span>
                       <button onClick={() => setShowSafeZones(!showSafeZones)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${showSafeZones ? 'bg-studio-accent text-black shadow-lg shadow-studio-accent/20' : 'bg-studio-sec text-studio-sub border border-studio-border'}`}>
                          {showSafeZones ? 'On' : 'Off'}
                       </button>
                    </div>
                    <div className="flex flex-col gap-3 items-end">
                       <span className="text-[10px] font-black uppercase text-studio-sub tracking-widest">{t('masterBG')}</span>
                       <div className="flex items-center gap-2">
                           <button onClick={() => setIsBgTransparent(!isBgTransparent)} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isBgTransparent ? 'bg-studio-accent text-black border-studio-accent' : 'bg-studio-sec border-studio-border text-studio-sub'}`} title={t('transparent')}>
                              <Ban size={16}/>
                           </button>
                           <div className={`relative w-10 h-10 rounded-xl overflow-hidden border border-studio-border transition-opacity ${isBgTransparent ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                             <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0" />
                           </div>
                       </div>
                    </div>
                 </div>

                 {/* Padding Slider */}
                 <div className="pt-4 border-t border-studio-border/50">
                    <div className="flex items-center justify-between mb-3">
                       <label className="text-[10px] font-black uppercase text-studio-sub tracking-widest flex items-center gap-2"><Scaling size={12}/> {t('lblPadding')}</label>
                       <span className="text-[10px] font-mono text-studio-accent">{Math.round(padding * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="0.5" 
                      step="0.01" 
                      value={padding} 
                      onChange={(e) => setPadding(parseFloat(e.target.value))} 
                      className="w-full h-1.5 bg-studio-sec rounded-lg appearance-none cursor-pointer accent-studio-accent hover:accent-studio-text transition-all"
                    />
                 </div>
              </div>

              <button onClick={generateSet} disabled={!files.universal.file || isGenerating} className={`w-full py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-4 transition-all shadow-2xl ${!files.universal.file ? 'bg-studio-sec text-studio-sub opacity-50 cursor-not-allowed' : 'bg-studio-accent text-black hover:scale-[1.02] hover:shadow-studio-accent/30'}`}>
                 {isGenerating ? <RefreshCw className="animate-spin" size={20}/> : <Zap size={18} fill="currentColor" />}
                 {isGenerating ? t('processing') : t('generate')}
              </button>
           </div>
        </aside>

        {/* MAIN: RESULTS */}
        <main className={`flex-1 md:overflow-y-auto no-scrollbar pb-40 md:pb-20 ${activeTab === 'forge' ? 'block' : 'hidden md:block'}`}>
           {generatedIcons.length === 0 ? (
             <div className="h-full min-h-[60vh] flex flex-col items-center justify-center opacity-10 p-20 text-center animate-spring">
                <div className="w-32 h-32 border-2 border-dashed border-studio-sub rounded-[3rem] flex items-center justify-center mb-10"><Hammer size={60} strokeWidth={1} /></div>
                <h3 className="text-2xl font-black uppercase tracking-[0.4em]">{t('readyForForge')}</h3>
                <p className="text-xs uppercase font-bold mt-4 tracking-widest">{t('readyDesc')}</p>
             </div>
           ) : (
             <div className="p-8 md:p-20 space-y-20 animate-spring">
                <header className="flex flex-col lg:flex-row items-center justify-between gap-8 glass-card p-10 md:p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent"></div>
                   <div className="flex items-center gap-8 relative z-10">
                      <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-inner"><Check size={40} className="text-emerald-500" strokeWidth={3} /></div>
                      <div>
                         <h4 className="text-2xl md:text-3xl font-black tracking-tight">{generatedIcons.length} {t('assetsComposed')}</h4>
                         <p className="text-[10px] text-studio-sub font-black uppercase tracking-widest mt-2">{t('assetsDesc')}</p>
                      </div>
                   </div>
                   <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto z-10">
                      <button onClick={() => {
                         const zip = new JSZip();
                         // Add all generated images
                         generatedIcons.forEach(i => zip.file(i.name, i.blob));
                         
                         // Generate and Add Manifest
                         const manifest = getManifestObject();
                         const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
                         zip.file('manifest.json', manifestBlob);

                         zip.generateAsync({type:"blob"}).then(c => FileSaver.saveAs(c, "icon-forge-assets.zip"));
                      }} className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-10 py-5 bg-studio-text text-studio-bg rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-studio-accent transition-all shadow-2xl shadow-studio-text/20">
                         <Download size={18}/> {t('download')}
                      </button>
                   </div>
                </header>

                <ContextPreview icons={generatedIcons} lang={lang} appName={appInfo.name} defaultTheme={defaultTheme} />

                {/* Groups */}
                {['logo', 'social', 'favicon'].map(type => {
                  const group = generatedIcons.filter(i => i.typeLabel === type);
                  if (group.length === 0) return null;
                  return (
                    <section key={type} className="space-y-8">
                       <div className="flex items-center gap-6">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-3 whitespace-nowrap bg-studio-bg pr-4">
                             {type === 'logo' ? <Shield size={16} className="text-studio-accent" /> : type === 'social' ? <Share2 size={16} className="text-sky-500" /> : <Grid3X3 size={16} className="text-amber-500" />}
                             {getSectionLabel(type)} {t('assets')}
                          </h3>
                          <div className="h-px w-full bg-studio-border"></div>
                       </div>
                       <div className={`grid gap-6 md:gap-8 ${type === 'social' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'}`}>
                          {group.map(icon => (
                            <div key={icon.id} className="flex flex-col gap-4 group">
                               <div className={`relative aspect-square rounded-[2.5rem] md:rounded-[3rem] border border-studio-border flex items-center justify-center shadow-xl overflow-hidden transition-all duration-500 hover:scale-105 ${icon.name.endsWith('.jpg') ? '' : 'bg-checkered'}`}>
                                  <img src={icon.url} className="max-w-[75%] max-h-[75%] object-contain relative z-10 drop-shadow-2xl" />
                                  <div className="absolute top-4 right-4 md:top-6 md:right-6 px-2 md:px-3 py-1 bg-studio-bg/90 backdrop-blur-md rounded-full text-[7px] md:text-[8px] font-black border border-studio-border z-20 shadow-lg tracking-tight uppercase">
                                     {icon.width > 0 ? `${icon.width}x${icon.height}` : t('vector')}
                                  </div>
                                  {icon.variant !== 'any' && (
                                    <div className={`absolute bottom-4 left-4 p-1.5 rounded-lg z-20 shadow-lg ${icon.variant === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-slate-800 text-slate-300'}`}>
                                      {icon.variant === 'light' ? <Sun size={12} /> : <Moon size={12} />}
                                    </div>
                                  )}
                               </div>
                               <span className="text-[9px] font-mono text-studio-sub text-center opacity-40 group-hover:opacity-100 truncate tracking-tight">{icon.name}</span>
                            </div>
                          ))}
                       </div>
                    </section>
                  );
                })}
             </div>
           )}
        </main>
      </div>

      {/* MOBILE BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-24 bg-studio-bg/95 backdrop-blur-3xl border-t border-studio-border z-[100] flex items-center justify-around px-8 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
          <button onClick={() => { setActiveTab('sources'); window.scrollTo(0, 0); }} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'sources' ? 'text-studio-accent' : 'text-studio-sub opacity-40'}`}>
              <div className={`p-3 rounded-2xl ${activeTab === 'sources' ? 'bg-studio-accent/20' : ''}`}><Hammer size={22} strokeWidth={2.5} /></div>
              <span className="text-[8px] font-black uppercase tracking-widest">{t('tabStudio')}</span>
          </button>
          {generatedIcons.length > 0 && (
            <button onClick={() => { setActiveTab('forge'); window.scrollTo(0, 0); }} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'forge' ? 'text-studio-accent' : 'text-studio-sub opacity-40'}`}>
                <div className={`p-3 rounded-2xl ${activeTab === 'forge' ? 'bg-studio-accent/20' : ''}`}><Zap size={22} strokeWidth={2.5} /></div>
                <span className="text-[8px] font-black uppercase tracking-widest">{t('tabForge')}</span>
            </button>
          )}
          <div className="flex flex-col items-center gap-1.5 opacity-40">
              <div className="p-3 rounded-2xl"><button onClick={() => setShowSettings(true)}><Settings size={22} /></button></div>
              <span className="text-[8px] font-black uppercase tracking-widest">{t('settings')}</span>
          </div>
      </nav>

      <style>{`
        .bg-checkered {
          background-image: linear-gradient(45deg, rgba(128, 128, 128, 0.1) 25%, transparent 25%), 
                            linear-gradient(-45deg, rgba(128, 128, 128, 0.1) 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, rgba(128, 128, 128, 0.1) 75%), 
                            linear-gradient(-45deg, transparent 75%, rgba(128, 128, 128, 0.1) 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </div>
  );
};

export default App;