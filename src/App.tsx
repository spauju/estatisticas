import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileType, AlertCircle, CheckCircle2, ChevronRight, BarChart3, Plus, ArrowRight, Download } from 'lucide-react';
import { analyzeChartFile, AnalysisResult } from './services/geminiService';
import { utils, writeFile } from 'xlsx';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(selectedFile.type)) {
      setError('Por favor, suba um arquivo PDF ou Imagem (PNG/JPG).');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    await processFile(selectedFile);
  };

  const processFile = async (file: File) => {
    try {
      setAnalyzing(true);
      setError(null);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });

      const base64 = await base64Promise;
      const data = await analyzeChartFile(base64, file.type);
      setResult(data);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro ao processar o arquivo. Tente novamente.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (['image/png', 'image/jpeg', 'application/pdf'].includes(droppedFile.type)) {
        setFile(droppedFile);
        setError(null);
        setResult(null);
        await processFile(droppedFile);
      } else {
        setError('Por favor, suba um arquivo PDF ou Imagem (PNG/JPG).');
      }
    }
  };

  const getStatusLabel = (percentage: number) => {
    if (percentage < 10) return 'NORMAL';
    if (percentage < 25) return 'ALERTA';
    return 'CRÍTICO';
  };

  const downloadExcel = () => {
    if (!result) return;

    // Calculate total sum for validation
    const totalSum = result.classes.reduce((acc, curr) => acc + curr.totalPercentage, 0);

    // Prepare data for Classes Sheet
    const classData = result.classes.map(cls => ({
      'Class (cm)': cls.deviationCm,
      'Total (%)': cls.totalPercentage.toFixed(2),
      'Status': getStatusLabel(cls.totalPercentage),
      'Segments/Details': cls.details.join(' | ')
    }));

    // Add a summary row
    classData.push({
      'Class (cm)': 'TOTAL GERAL',
      'Total (%)': totalSum.toFixed(2),
      'Status': '-',
      'Segments/Details': ''
    } as any);

    // Prepare data for Raw Extractions Sheet
    const rawData = result.rawExtractions.map(ext => ({
      'Segment/Side': ext.side,
      'Value (cm)': ext.deviation,
      'Percentage (%)': ext.percentage,
      'Status': getStatusLabel(ext.percentage)
    }));

    const wb = utils.book_new();
    
    // Better column widths and formatting could be done with more xlsx features, 
    // but for now we focus on data order which is already Class -> Total -> Status -> Details.
    const wsClasses = utils.json_to_sheet(classData);
    utils.book_append_sheet(wb, wsClasses, "Resumo por Classe");

    const wsRaw = utils.json_to_sheet(rawData);
    utils.book_append_sheet(wb, wsRaw, "Extrações Brutas");

    writeFile(wb, `analise_paralelismo_${file?.name.split('.')[0] || 'export'}.xlsx`);
  };

  const getStatusColor = (percentage: number) => {
    if (percentage < 10) return 'text-emerald-600';
    if (percentage < 25) return 'text-amber-500';
    return 'text-rose-600';
  };

  const getStatusBg = (percentage: number) => {
    if (percentage < 10) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (percentage < 25) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-rose-50 text-rose-700 border-rose-100';
  };

  const getBgColor = (percentage: number) => {
    if (percentage < 10) return 'bg-white';
    if (percentage < 25) return 'bg-white border-amber-100';
    return 'bg-white border-rose-100';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-600 selection:text-white">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      
      <main id="main-content" className="max-w-6xl mx-auto px-6 py-12 md:py-24 relative z-10">
        {/* Header */}
        <header id="page-header" className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <BarChart3 size={20} className="text-indigo-600" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Paralellism TechLab</span>
          </div>
          <h1 className="text-5xl md:text-8xl font-sans font-bold tracking-tight leading-[0.9] text-slate-900 mb-8">
            Analisador <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">Multiclasse.</span>
          </h1>
          <p className="max-w-2xl text-xl text-slate-500 leading-relaxed font-normal">
            Extração automatizada de desvios via visão computacional. Converta relatórios visuais complexos em dados estruturados e consolidados instantaneamente.
          </p>
        </header>

        <section id="analyzer-grid" className="grid lg:grid-cols-12 gap-16 items-start">
          {/* Upload Section */}
          <div id="upload-section" className="lg:col-span-5 space-y-10 sticky top-12">
            <div 
              id="drop-zone"
              onDragOver={onDragOver}
              onDrop={onDrop}
              className={`
                relative aspect-square flex flex-col items-center justify-center 
                rounded-3xl border-2 border-dashed transition-all duration-500 overflow-hidden
                ${analyzing 
                  ? 'border-indigo-200 bg-white cursor-wait' 
                  : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 cursor-pointer lg:scale-105'}
              `}
            >
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-wait z-20"
                accept="image/*,application/pdf"
                disabled={analyzing}
              />
              
              <AnimatePresence mode="wait">
                {analyzing ? (
                  <motion.div 
                    key="analyzing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="flex flex-col items-center gap-6 text-center px-10 relative z-10"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
                      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                    </div>
                    <div>
                      <span className="font-sans text-sm font-semibold text-slate-900 block mb-1">Processando Visão...</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 animate-pulse">Lendo padrões de paralelismo</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center gap-8 px-12 relative z-10"
                  >
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                      <Upload size={32} />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-xl text-slate-900">Importe seu Arquivo</p>
                      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                        Arraste o PDF ou Imagem do relatório<br/> para iniciar a extração térmica.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {file && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-xl text-slate-400">
                    <FileType size={20} />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold truncate max-w-[180px] text-slate-900">{file.name}</span>
                    <span className="block text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                {result && (
                  <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-full">
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 text-rose-600 bg-rose-50 p-5 rounded-2xl border border-rose-100"
              >
                <AlertCircle size={20} />
                <span className="text-sm font-medium leading-tight">{error}</span>
              </motion.div>
            )}
          </div>

          {/* Results Section */}
          <div id="results-section" className="lg:col-span-7 min-h-[500px]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div 
                  key="results"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-10"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-6">
                    <div>
                      <h3 className="font-sans text-xl font-bold text-slate-900">
                         Detalhamento por Classe
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">{result.classes.length} grupos de desvio detectados</p>
                    </div>
                    <button 
                      onClick={downloadExcel}
                      className="group flex items-center justify-center gap-2 font-sans text-xs font-bold text-white bg-slate-900 hover:bg-indigo-600 px-6 py-3 rounded-full transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95 cursor-pointer"
                    >
                      <Download size={14} />
                      Exportar Relatório Excel
                    </button>
                  </div>

                  <div className="space-y-6">
                    {result.classes.map((cls, idx) => (
                      <div key={idx} className={`p-8 rounded-3xl border transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/50 ${getBgColor(cls.totalPercentage)}`}>
                        <div className="grid sm:grid-cols-2 gap-8 items-end mb-8">
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 block mb-3 font-semibold">Classe de Medida</span>
                            <span className="text-6xl font-sans tracking-tight font-bold text-slate-900">
                              {cls.deviationCm} <span className="text-2xl font-medium text-slate-400">cm</span>
                            </span>
                          </div>
                          <div className="sm:text-right">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 block mb-3 font-semibold">Acumulado Total</span>
                            <div className="flex sm:justify-end items-center gap-3">
                               <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusBg(cls.totalPercentage)}`}>
                                 {getStatusLabel(cls.totalPercentage)}
                               </div>
                               <span className={`text-6xl font-mono tracking-tight font-bold ${getStatusColor(cls.totalPercentage)}`}>
                                 {cls.totalPercentage.toFixed(1)}%
                               </span>
                            </div>
                          </div>
                        </div>

                        {/* Analysis Detail below each class */}
                        <div className="space-y-4 border-t border-slate-100 pt-6">
                           <div className="grid grid-cols-1 gap-2">
                              {cls.details.map((detail, i) => (
                                <div key={i} className="flex items-center justify-between font-sans text-[13px] bg-slate-50/50 p-4 rounded-2xl border border-slate-100 hover:bg-white transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(cls.totalPercentage)} shadow-[0_0_8px_rgba(0,0,0,0.1)]`}></div>
                                    <span className="text-slate-600 font-medium">{detail.split(':')[0]}</span>
                                  </div>
                                  <span className="font-mono font-bold text-slate-900">{detail.split(':')[1]?.trim()}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Individual breakdown moved to a more accessory role */}
                  <div className="pt-12 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                        <Plus size={12} />
                      </div>
                      <h4 className="font-sans text-[11px] uppercase tracking-[0.2em] text-slate-400 font-extrabold">
                        Registros de Inspeção Unitária
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {result.rawExtractions.map((ext, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all group">
                          <div className="flex justify-between items-start mb-4">
                             <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">{ext.side}</div>
                             <BarChart3 size={12} className="text-slate-200 group-hover:text-indigo-200" />
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-lg font-bold text-slate-900">{ext.deviation} cm</span>
                            <span className={`text-sm font-mono font-bold ${getStatusColor(ext.percentage)}`}>
                              {ext.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 lg:py-40">
                   <div className="p-16 rounded-[40px] border border-slate-200 bg-white/50 backdrop-blur-sm space-y-6 relative group overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                     <Plus size={40} className="mx-auto text-slate-200 group-hover:rotate-90 transition-transform duration-700" />
                     <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-slate-400 font-bold">Dashboard Inativo</p>
                     <p className="text-sm text-slate-400 max-w-[200px] mx-auto leading-relaxed">Suba um arquivo para gerar o mapa de precisão.</p>
                   </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-200 flex flex-col md:flex-row justify-between gap-12 mt-20 text-slate-400">
        <div className="space-y-6">
          <p className="font-mono text-[10px] uppercase tracking-widest font-bold">Protocolo de Processamento</p>
          <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold font-sans">
            <span className="text-slate-300">SCAN</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <span className="text-slate-300">EXTRACT</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <span className="text-indigo-400">CLASSIFY</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <span className="text-slate-300">CONSOL</span>
          </div>
        </div>
        <div className="flex flex-col md:items-end gap-3 text-[10px] font-mono font-bold uppercase tracking-widest">
           <span>Build 2024.04 // Engine G3P</span>
           <span className="opacity-50 underline decoration-indigo-500/30 underline-offset-4">Relatório Digital Certificado</span>
        </div>
      </footer>
    </div>
  );
}
