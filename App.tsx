import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Settings, Image as ImageIcon, Layers, Monitor, Smartphone, Globe, Info, Check, RefreshCw, X, AlertTriangle, Edit2, ZoomIn, Maximize, Moon, Sun, UploadCloud, Eye, LayoutTemplate, Grid, Palette, Sliders, ChevronRight, Minimize } from 'lucide-react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { ICON_DEFINITIONS, GeneratedFile, IconCategory, IconDefinition, EditOptions, IconVariant } from './types';
import { processImage, getDominantColor } from './utils/imageProcessor';
import { generateIco } from './utils/icoGenerator';

const App: React.FC = () => {
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
    const icoSizes = [16, 32, 48];
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
    // Prefer main source for SVG unless it's strictly a pixel replacement flow, 
    // but typically SVG source is the "main" vector.
    // However, if the user uploaded an SVG as the small source, they might want that specific SVG.
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
      // Use smallFile if available for small icons
      const lightSet = await generateSet(file, smallFile, 'light');
      let finalSet = [...lightSet];

      // Generate Dark Set
      // We generate dark set if either a Main Dark file exists OR if we want to infer dark from main file (not implemented yet, usually requires manual input)
      // For now, consistent with previous logic: if Dark File exists, we generate.
      if (darkFile) {
        // Use smallDarkFile if available, otherwise fallback to darkFile for small icons
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
    
    // Manifest
    const pwaIcons = generatedIcons.filter(i => i.category === 'pwa' && i.variant === 'light');
    const manifestContent = {
      name: "My App",
      short_name: "App",
      start_url: "/",
      display: "standalone",
      background_color: brandColor,
      theme_color: brandColor,
      icons: pwaIcons.map(i => ({
          src: `/${i.name}`,
          sizes: `${i.width}x${i.height}`,
          type: "image/png",
          purpose: i.name.includes('maskable') ? 'maskable' : 'any'
        }))
    };
    folder?.file("manifest.json", JSON.stringify(manifestContent, null, 2));

    const content = await zip.generateAsync({ type: "blob" });
    FileSaver.saveAs(content, "icon-forge-assets.zip");
  };


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

  const categories: { id: IconCategory | 'all', label: string, icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <Layers size={16} /> },
    { id: 'web', label: 'Web', icon: <Globe size={16} /> },
    { id: 'ios', label: 'iOS', icon: <Smartphone size={16} /> },
    { id: 'pwa', label: 'PWA', icon: <Smartphone size={16} /> },
    { id: 'windows', label: 'Windows', icon: <Monitor size={16} /> },
    { id: 'macos', label: 'macOS', icon: <Monitor size={16} /> },
    { id: 'linux', label: 'Linux', icon: <Monitor size={16} /> },
    { id: 'social', label: 'Social', icon: <ImageIcon size={16} /> },
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
    optional = false
  }: { 
    file: File | null, 
    preview: string | null, 
    type: UploadType, 
    label: string, 
    icon: React.ReactNode, 
    height?: string,
    optional?: boolean 
  }) => (
    <div>
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        {icon} {label} {optional && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-normal ml-auto">Optional</span>}
      </label>
      {!file ? (
        <label className={`flex flex-col items-center justify-center ${height} border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30 hover:bg-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group`}>
          <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 mb-2" />
          <span className="text-[10px] text-slate-400">Upload</span>
          <input type="file" className="hidden" onChange={(e) => handleFileChange(e, type)} />
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
    <div className="h-screen bg-slate-950 text-slate-100 font-sans flex overflow-hidden">
      <input type="file" ref={overrideInputRef} hidden accept="image/*" onChange={handleOverrideFileChange} />

      {/* --- SIDEBAR --- */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-6 border-b border-slate-800">
           <div className="flex items-center gap-2 mb-1">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">IF</div>
             <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Icon Forge</h1>
           </div>
           <p className="text-xs text-slate-500 ml-10">Professional Asset Generator</p>
        </div>

        <div className="p-6 space-y-6 flex-1">
          
          {/* Main Sources */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Main Sources</h3>
            <UploadZone 
              file={file} preview={previewUrl} type="main" 
              label="Primary (>128px)" icon={<Sun size={14} className="text-amber-400" />} 
            />
            <UploadZone 
              file={darkFile} preview={darkPreviewUrl} type="dark" 
              label="Dark Mode (>128px)" icon={<Moon size={14} className="text-indigo-400" />} 
              optional 
              height="h-24"
            />
          </div>

          {/* Small Sources */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Small Sizes</h3>
            <div className="grid grid-cols-2 gap-3">
              <UploadZone 
                file={smallFile} preview={smallPreviewUrl} type="small" 
                label="Light (<128px)" icon={<Minimize size={14} className="text-slate-400" />} 
                optional height="h-20"
              />
              <UploadZone 
                file={smallDarkFile} preview={smallDarkPreviewUrl} type="small-dark" 
                label="Dark (<128px)" icon={<Minimize size={14} className="text-slate-500" />} 
                optional height="h-20"
              />
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Brand Color</label>
                <div className="flex gap-2 items-center">
                    <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded" />
                    <input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 w-24 font-mono text-slate-300" />
                </div>
             </div>
             
             <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
                <input type="checkbox" checked={keepOriginalBackground} onChange={(e) => setKeepOriginalBackground(e.target.checked)} className="mt-0.5 accent-indigo-500" />
                <div>
                    <span className="block text-sm font-medium text-slate-300">Preserve Source Bg</span>
                    <span className="block text-xs text-slate-500 mt-1">Don't fill transparent areas with brand color for opaque icons (e.g., iOS).</span>
                </div>
             </label>
          </div>

        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900 sticky bottom-0">
          <button 
            onClick={handleGenerate}
            disabled={!file || isGenerating}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${!file ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 active:scale-95'}`}
          >
            {isGenerating ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
            {isGenerating ? 'Processing...' : 'Generate Assets'}
          </button>
        </div>
      </aside>

      {/* --- MAIN DASHBOARD --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950/50">
        
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
                {categories.map(cat => (
                    <button 
                        key={cat.id} 
                        onClick={() => setActiveTab(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${activeTab === cat.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        {cat.icon} {cat.label}
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
                    <Download size={16}/> Download All
                </button>
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
            {generatedIcons.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-xl">
                        <ImageIcon size={48} className="opacity-20" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 mb-2">Ready to Forge</h3>
                    <p className="max-w-md text-center text-sm">Upload your primary logo in the sidebar to generate optimized assets for Web, iOS, Android, and Windows instantly.</p>
                </div>
            ) : (
                <div className="max-w-5xl mx-auto space-y-10 pb-20">
                    {Object.entries(groupedDefinitions).map(([category, defs]) => {
                        if (activeTab !== 'all' && activeTab !== category) return null;

                        return (
                            <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                                    {category} Assets
                                </h2>
                                
                                <div className="space-y-3">
                                    {defs.map((def) => {
                                        // Find generated files for this definition
                                        const lightIcon = generatedIcons.find(i => i.originalDef.name === def.name && i.variant === 'light');
                                        // Find dark equivalent
                                        const darkIcon = generatedIcons.find(i => i.originalDef.name === def.name && i.variant === 'dark');
                                        
                                        if (!lightIcon) return null;

                                        return (
                                            <div key={def.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-6 hover:border-indigo-500/30 transition-colors group relative">
                                                
                                                {/* Info Column */}
                                                <div className="w-64 shrink-0">
                                                    <h3 className="font-bold text-slate-200 text-sm truncate" title={def.label || def.name}>{def.label || def.name}</h3>
                                                    <p className="text-xs text-slate-500 font-mono mt-1">{def.name}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{def.width > 0 ? `${def.width}x${def.height}` : 'Vector/Multi'}</span>
                                                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700 uppercase">{def.format}</span>
                                                    </div>
                                                </div>

                                                {/* Preview Grid: Side by Side */}
                                                <div className="flex-1 grid grid-cols-2 gap-4">
                                                    
                                                    {/* Light Mode Card */}
                                                    <div className="relative border border-slate-800 bg-slate-950 rounded-lg p-3 flex flex-col items-center group/card transition-all hover:bg-slate-900/50">
                                                        <div className="absolute top-2 left-2 text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Sun size={10}/> Light</div>
                                                        <div className={`w-20 h-20 mb-2 rounded flex items-center justify-center overflow-hidden border border-slate-800/50 ${getDashboardBgClass()}`}>
                                                            {lightIcon.url ? (
                                                                <img src={lightIcon.url} className="max-w-full max-h-full object-contain" alt="light" />
                                                            ) : (
                                                                <span className="text-xs text-slate-600">N/A</span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                            {lightIcon.width > 0 && <button onClick={() => openEditor(lightIcon)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title="Edit / Analyze"><Edit2 size={12}/></button>}
                                                            <button onClick={() => handleOverrideClick(lightIcon.id)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title="Replace"><UploadCloud size={12}/></button>
                                                        </div>
                                                    </div>

                                                    {/* Dark Mode Card (if applicable) */}
                                                    {darkIcon ? (
                                                        <div className="relative border border-slate-800 bg-slate-950 rounded-lg p-3 flex flex-col items-center group/card transition-all hover:bg-slate-900/50">
                                                            <div className="absolute top-2 left-2 text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Moon size={10}/> Dark</div>
                                                            <div className={`w-20 h-20 mb-2 rounded flex items-center justify-center overflow-hidden border border-slate-800/50 ${getDashboardBgClass()}`}>
                                                                <img src={darkIcon.url} className="max-w-full max-h-full object-contain" alt="dark" />
                                                            </div>
                                                            <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                                {darkIcon.width > 0 && <button onClick={() => openEditor(darkIcon)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title="Edit / Analyze"><Edit2 size={12}/></button>}
                                                                <button onClick={() => handleOverrideClick(darkIcon.id)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-indigo-600 hover:text-white" title="Replace"><UploadCloud size={12}/></button>
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

      {/* --- MODAL (Editor / Analysis) --- */}
      {editingIcon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
            <div className="bg-slate-900 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden border border-slate-800">
                
                {/* Modal Sidebar */}
                <div className="w-80 bg-slate-950 border-r border-slate-800 p-6 flex flex-col overflow-y-auto">
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        <Edit2 size={18} className="text-indigo-400"/> Editor & Analysis
                    </h3>
                    <p className="text-xs text-slate-500 mb-6">{editingIcon.name}</p>

                    {/* Controls */}
                    <div className="space-y-6 flex-1">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">View Mode</label>
                            <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                                <button onClick={() => setModalViewMode('fit')} className={`flex-1 py-1.5 text-xs font-medium rounded ${modalViewMode === 'fit' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Fit Screen</button>
                                <button onClick={() => setModalViewMode('actual')} className={`flex-1 py-1.5 text-xs font-medium rounded ${modalViewMode === 'actual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Real Size (1:1)</button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Preview Background</label>
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
                                Keep Source Background
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
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><Eye size={12}/> Analysis</h4>
                        {editAnalysis.length > 0 ? (
                            <ul className="space-y-2">
                                {editAnalysis.map((msg, i) => (
                                    <li key={i} className="text-xs text-amber-400 flex items-start gap-2">
                                        <AlertTriangle size={12} className="shrink-0 mt-0.5"/> {msg}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-emerald-400 flex items-center gap-2"><Check size={12}/> Good visibility detected.</p>
                        )}
                    </div>
                    
                    <div className="mt-6 flex gap-3">
                        <button onClick={closeEditor} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium">Cancel</button>
                        <button onClick={saveEditedIcon} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium shadow-lg shadow-indigo-500/20">Save</button>
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
  );
};

export default App;