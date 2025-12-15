import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import landingImage from '../assets/landingImage.png';

import photo1 from '../assets/photo1.jpg';
import photo2 from '../assets/photo2.jpg';
import photo3 from '../assets/photo3.jpg';
import photo4 from '../assets/photo4.jpg';
import photo5 from '../assets/photo5.jpg';
import photo6 from '../assets/photo6.jpg';
import photo7 from '../assets/photo7.jpg';

const MY_PHOTOS = [
  photo1,
  photo2,
  photo3,
  photo4,
  photo5,
  photo6,
  photo7
];

const TRANSITION = "transition-all duration-700 ease-out";

const getStepClass = (step: number, trigger: number) => {
  return step >= trigger 
    ? 'opacity-100 translate-y-0 filter-none' 
    : 'opacity-0 translate-y-8 blur-sm pointer-events-none';
};

const PhotoSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MY_PHOTOS.length);
    }, 3000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-900 rounded-2xl">
      {MY_PHOTOS.map((photo, index) => (
        <div
          key={index}
          className={`absolute inset-0 w-full h-full transition-all duration-1000 ease-in-out ${
            index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-110'
          }`}
        >
          <img 
            src={photo} 
            alt={`Xogando ${index + 1}`} 
            className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent"></div>
        </div>
      ))}
      
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {MY_PHOTOS.map((_, idx) => (
          <div 
            key={idx} 
            className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${
              idx === currentIndex ? 'bg-blue-500 w-6' : 'bg-white/40 w-1.5'
            }`} 
          />
        ))}
      </div>
    </div>
  );
};

export default function Slides() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();

  const slides = [
    
    // 1. PORTADA
    {
      id: 'portada',
      totalSteps: 0,
      render: () => (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-gray-950 selection:bg-blue-500/30">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-10 animate-in fade-in zoom-in duration-1000 slide-in-from-bottom-8">
            <div className="relative group animate-[bounce_4s_infinite]"> 
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full blur-xl opacity-20 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative w-44 h-44 bg-gray-900/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-gray-700/50 shadow-2xl group-hover:scale-105 transition-transform duration-500 ring-1 ring-white/10">
                <span className="text-8xl drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">🏐</span>
              </div>
            </div>
            <div className="space-y-4">
              <h1 className="text-9xl font-black tracking-tighter bg-gradient-to-b from-white via-gray-200 to-gray-500 bg-clip-text text-transparent drop-shadow-sm">Gaeliza</h1>
              <div className="flex items-center justify-center gap-4">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-blue-500"></div>
                <span className="text-blue-400 font-mono text-sm tracking-[0.3em] uppercase">V 1.0.0</span>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-blue-500"></div>
              </div>
              <h2 className="text-2xl text-gray-400 font-light tracking-wide max-w-xl mx-auto leading-relaxed pt-2">
                Revolucionando a análise do <span className="text-white font-medium">Fútbol Gaélico</span>
              </h2>
            </div>
            <div className="mt-12 group perspective-1000">
              <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-md p-px rounded-2xl overflow-hidden transition-transform duration-500 hover:rotate-x-12 hover:scale-105 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"></div>
                <div className="relative bg-gray-950/90 rounded-2xl p-6 min-w-[320px] flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-600 flex items-center justify-center text-2xl font-bold text-white shadow-inner">DC</div>
                  <div className="text-left">
                    <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Desenvolvedor Web</p>
                    <p className="text-2xl text-white font-bold leading-none mb-1">David Chaves Rodríguez</p>
                    <p className="text-gray-500 text-xs font-mono">DAW • TFC 2025</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-10 animate-pulse text-gray-500 text-xs font-mono tracking-widest uppercase flex flex-col items-center gap-2">
            <span>Preme espazo para comezar</span>
            <span className="text-lg">↓</span>
          </div>
        </div>
      )
    },

    // 2. CONTEXTO
    {
      id: 'contexto',
      totalSteps: 3, 
      render: (s: number) => (
        <div className="flex flex-col justify-center h-full px-16 max-w-7xl mx-auto">
          <h2 className="text-6xl font-black text-white mb-10 pl-6 border-l-8 border-green-500 animate-in slide-in-from-left duration-700">
            <span className="text-gray-500 text-2xl block font-mono font-normal tracking-wider mb-2 uppercase">Contexto</span>
            O Fútbol Gaélico
          </h2>
          <div className="grid grid-cols-2 gap-12 h-[60vh]">
            <div className="space-y-6 flex flex-col h-full">
              <div className={`bg-gray-800/40 p-6 rounded-3xl border border-gray-700 relative overflow-hidden ${TRANSITION} ${getStepClass(s, 1)}`}>
                <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-3">🍀 Que é?</h3>
                <div className="flex items-center justify-around text-lg text-gray-300 font-bold">
                  <span>⚽ Soccer</span><span className="text-green-500">+</span><span>🏉 Rugby</span><span className="text-green-500">=</span><span className="text-white">🏐 Gaélico</span>
                </div>
              </div>
              <div className={`flex-1 relative rounded-3xl overflow-hidden border-4 border-gray-800 shadow-2xl group ${TRANSITION} ${getStepClass(s, 3)}`}>
                <div className="absolute top-4 left-4 z-20 bg-blue-600/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md shadow-lg border border-white/20">🙋‍♂️ NÓS XOGANDO</div>
                <PhotoSlider />
                <div className="absolute bottom-0 inset-x-0 p-6 z-20 bg-gradient-to-t from-black/80 to-transparent pt-12">
                  <h3 className="text-xl font-bold text-white mb-1 drop-shadow-md">Unha necesidade real</h3>
                  <p className="text-sm text-gray-200 leading-tight drop-shadow-md">Esta app resolve os problemas que vivimos nós mesmos cada fin de semana no campo.</p>
                </div>
              </div>
            </div>
            <div className={`flex flex-col justify-center space-y-8 ${TRANSITION} ${getStepClass(s, 2)}`}>
              <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-2xl relative h-full flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-white mb-8 text-center">Sistema de Puntuación</h3>
                <div className="relative h-64 w-full flex justify-center items-end mx-auto">
                  <div className="w-4 h-full bg-gray-600 rounded-t-lg absolute left-1/4"></div>
                  <div className="w-4 h-full bg-gray-600 rounded-t-lg absolute right-1/4"></div>
                  <div className="h-2 w-1/2 bg-gray-600 absolute top-1/2 left-1/4 right-1/4"></div>
                  <div className="absolute bottom-0 w-1/2 h-1/2 left-1/4 bg-gray-800 border-2 border-gray-600 opacity-50"></div>
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce">
                    <span className="text-4xl">🏐</span><span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full mt-1">1 PUNTO</span>
                  </div>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full mb-1 shadow-[0_0_15px_rgba(22,163,74,0.6)]">3 PUNTOS (GOL)</span><span className="text-4xl">⚽</span>
                  </div>
                </div>
                <div className="mt-6 bg-gray-800 p-4 rounded-xl text-center border border-gray-700">
                  <p className="text-gray-400 text-sm font-mono">Total = (Goles x 3) + Puntos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // 3. INTRO
    {
      id: 'intro',
      totalSteps: 2, 
      render: (s: number) => (
        <div className="flex flex-col justify-center h-full px-16 max-w-7xl mx-auto">
          <div className="mb-12 pl-6 border-l-8 border-blue-600 animate-in slide-in-from-left duration-700">
            <span className="text-blue-400 font-mono text-sm tracking-widest uppercase mb-2 block">Necesidade da APP</span>
            <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">Do papel á nube</h2>
          </div>
          <div className="grid grid-cols-12 gap-16 items-center h-[60vh]">
            <div className="col-span-5 flex flex-col justify-center space-y-6 relative">
              <div className={`relative bg-red-950/10 backdrop-blur-sm p-6 rounded-2xl border border-red-900/30 overflow-hidden group ${TRANSITION} ${getStepClass(s, 1)}`}>
                <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl grayscale group-hover:grayscale-0 transition-all duration-500">🌧️</div>
                <div className="relative z-10">
                  <h3 className="text-2xl text-red-400 mb-4 font-bold flex items-center gap-3"><span className="bg-red-900/50 p-2 rounded-lg text-lg">⚠️</span> O problema</h3>
                  <ul className="space-y-3 text-red-200/60 text-lg">
                  <li className="flex gap-3 items-center"><span className="text-red-500 font-bold">✕</span> Análises crípticos.</li>
                    <li className="flex gap-3 items-center"><span className="text-red-500 font-bold">✕</span> Libretas molladas.</li>
                    <li className="flex gap-3 items-center"><span className="text-red-500 font-bold">✕</span> Follas de cálculo aburridas.</li>
                    <li className="flex gap-3 items-center"><span className="text-red-500 font-bold">✕</span> Difícil análise e compartición.</li>
                  </ul>
                </div>
              </div>
              <div className={`flex justify-center -my-3 z-20 ${TRANSITION} ${getStepClass(s, 2)}`}><div className="bg-gray-800 p-2 rounded-full border border-gray-600 animate-bounce text-blue-400 text-xl shadow-lg">↓</div></div>
              <div className={`relative bg-gradient-to-br from-blue-900/20 to-cyan-900/20 backdrop-blur-md p-6 rounded-2xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.1)] hover:border-cyan-400/50 transition-all duration-500 ${TRANSITION} ${getStepClass(s, 2)}`}>
                <div className="absolute top-0 right-0 p-4 opacity-20 text-8xl rotate-12">🚀</div>
                <h3 className="text-2xl text-cyan-300 mb-4 font-bold flex items-center gap-3 relative z-10"><span className="bg-cyan-900/50 p-2 rounded-lg text-lg text-cyan-200">✨</span> Gaeliza</h3>
                <ul className="space-y-3 text-cyan-50 text-lg relative z-10">
                  <li className="flex gap-3 items-center"><span className="text-cyan-400 font-bold">✓</span> Aplicación web multiplataforma.</li>
                  <li className="flex gap-3 items-center"><span className="text-cyan-400 font-bold">✓</span> Sincronizada na nube.</li>
                  <li className="flex gap-3 items-center"><span className="text-cyan-400 font-bold">✓</span> Capacidade de análise automática.</li>
                </ul>
              </div>
            </div>
            <div className={`col-span-7 h-full flex items-center perspective-1000 ${TRANSITION} ${getStepClass(s, 0)}`}>
              <div className="relative w-full group transform transition-all duration-1000 hover:rotate-y-[-2deg] hover:scale-[1.01]">
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/30 via-purple-600/30 to-cyan-500/30 rounded-[2rem] blur-2xl opacity-50 group-hover:opacity-80 animate-pulse"></div>
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-[6px] border-gray-800 bg-gray-900 aspect-video">
                  <div className="absolute top-0 left-0 w-full h-8 bg-gray-800 flex items-center px-4 gap-2 z-20 opacity-80">
                    <div className="w-3 h-3 rounded-full bg-red-500/50"></div><div className="w-3 h-3 rounded-full bg-yellow-500/50"></div><div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                    <div className="mx-auto bg-gray-900 px-4 py-0.5 rounded text-[10px] text-gray-500 font-mono">gaeliza.app</div>
                  </div>
                  <img src={landingImage} alt="Interface" className="w-full h-full object-cover object-top pt-8 hover:scale-105 transition-transform duration-[2s]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

// 4. STACK
{
    id: 'stack',
    totalSteps: 2, 
    render: (s: number) => (
      <div className="flex flex-col justify-center h-full px-16 max-w-7xl mx-auto">
        <div className="flex items-end gap-4 mb-12 border-l-8 border-purple-500 pl-6">
          <h2 className="text-5xl font-bold text-white">Stack Tecnolóxico</h2>
          <span className="text-gray-500 font-mono text-sm pb-2">/package.json</span>
        </div>

        <div className="grid grid-cols-2 gap-12">
          
          <div className={`space-y-6 ${TRANSITION} ${getStepClass(s, 1)}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-2xl">💻</div>
              <h3 className="text-2xl font-bold text-blue-400">Cliente (Frontend)</h3>
            </div>
            
            <div className="grid gap-4">
              <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-blue-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">⚛️</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-lg">React</span>
                    <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">v19</span>
                  </div>
                  <p className="text-gray-400 text-sm">Framework de Javascript moi popular e moderno.</p>
                </div>
              </div>

              <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-blue-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🛡️</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-lg">TypeScript</span>
                    <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Tipado estricto</span>
                  </div>
                  <p className="text-gray-400 text-sm">Superset tipado para evitar bugs.</p>
                </div>
              </div>

              <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-cyan-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🎨</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-lg">Tailwind CSS</span>
                    <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">Estilos</span>
                  </div>
                  <p className="text-gray-400 text-sm">Estilizado rápido e responsive.</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-pink-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📄</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-lg">jsPDF</span>
                    <span className="text-[10px] font-mono bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded">Librería</span>
                  </div>
                  <p className="text-gray-400 text-sm">Xeración de actas en PDF no cliente.</p>
                </div>
              </div>
          </div>

          <div className={`space-y-6 ${TRANSITION} ${getStepClass(s, 2)}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20 text-2xl">☁️</div>
              <h3 className="text-2xl font-bold text-green-400">Servidor (BaaS)</h3>
            </div>

            <div className="grid gap-4">
              <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-green-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">⚡</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-lg">Supabase</span>
                    <span className="text-[10px] font-mono bg-green-500/20 text-green-300 px-2 py-0.5 rounded">PostgreSQL</span>
                  </div>
                  <p className="text-gray-400 text-sm">Base de datos relacional e autenticación sinxela.</p>
                </div>
              </div>

              <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-green-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🔒</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-lg">Políticas RLS</span>
                    <span className="text-[10px] font-mono bg-green-500/20 text-green-300 px-2 py-0.5 rounded">Security</span>
                  </div>
                  <p className="text-gray-400 text-sm">Seguridade a nivel de fila (Row Level Security).</p>
                </div>
              </div>
              <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-green-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📂</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-lg">Autenticación e almacenamento</span>
                    <span className="text-[10px] font-mono bg-green-500/20 text-green-300 px-2 py-0.5 rounded">Auth</span>
                  </div>
                  <p className="text-gray-400 text-sm">Xestión segura de usuarios e arquivos multimedia.</p>
                </div>
              </div>

              <div className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 transition-colors group">
  <div className="w-12 h-12 rounded-lg bg-green-900/30 flex items-center justify-center text-3xl group-hover:rotate-90 transition-transform duration-500">⚙️</div>
  <div className="flex-1">
    <div className="flex justify-between items-center">
      <span className="font-bold text-white text-lg">DB Triggers</span>
      <span className="text-[10px] font-mono bg-green-500/20 text-green-300 px-2 py-0.5 rounded">pgSQL</span>
    </div>
    <p className="text-gray-400 text-sm">Execución automática de código ante cambios.</p>
  </div>
</div>

            </div>
          </div>

        </div>
      </div>
    )
  },

// 5. ARQUITECTURA
{
    id: 'arquitectura',
    totalSteps: 2, 
    render: (s: number) => (
      <div className="flex flex-col justify-center h-full px-16 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-2 border-b border-gray-700 pb-4 z-20 relative bg-gray-900/50 backdrop-blur-sm">
          <div>
            <h2 className="text-5xl font-bold text-white mb-2">Arquitectura de Datos</h2>
            <p className="text-gray-400 font-mono text-sm">PostgreSQL Relacional en Supabase</p>
          </div>
          <div className="flex gap-2">
             <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${s >= 1 ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>1. SCHEMA</span>
             <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${s >= 2 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>2. SECURITY</span>
          </div>
        </div>

        <div className="relative h-[60vh] w-full mt-42">
          
          <div className={`transition-all duration-700 ${s >= 2 ? 'blur-sm opacity-40 scale-95' : 'opacity-100 scale-100'}`}>
            
            <div className={`absolute top-1/2 left-20 -translate-y-1/2 w-64 bg-slate-800 rounded-xl border-2 border-blue-500/50 overflow-hidden shadow-2xl z-10 ${TRANSITION} ${getStepClass(s, 1)}`}>
              <div className="bg-slate-900/50 p-3 border-b border-blue-500/30 flex justify-between items-center">
                <span className="font-bold text-blue-400">matches</span>
                <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 rounded">PK</span>
              </div>
              <div className="p-4 space-y-2 font-mono text-xs text-slate-300">
                <div className="flex justify-between"><span>id</span><span className="text-slate-500">uuid</span></div>
                <div className="flex justify-between"><span>user_id</span><span className="text-yellow-500">uuid</span></div>
                <div className="flex justify-between"><span>rival</span><span className="text-slate-500">text</span></div>
                <div className="flex justify-between"><span>date</span><span className="text-slate-500">timestamp</span></div>
              </div>
            </div>

            <div className={`absolute top-1/2 left-80 w-32 h-[1px] bg-gradient-to-r from-blue-500 to-gray-600 -translate-y-1/2 z-0 ${TRANSITION} ${getStepClass(s, 1)}`}></div>
            
            <div className={`absolute top-[30%] bottom-[30%] left-[28rem] w-[1px] bg-gray-600 z-0 ${TRANSITION} ${getStepClass(s, 1)}`}></div>
            <div className={`absolute top-[30%] left-[28rem] w-8 h-[1px] bg-gray-600 z-0 ${TRANSITION} ${getStepClass(s, 1)}`}></div>
            <div className={`absolute bottom-[30%] left-[28rem] w-8 h-[1px] bg-gray-600 z-0 ${TRANSITION} ${getStepClass(s, 1)}`}></div>

            <div className={`absolute top-[20%] left-[30rem] w-56 bg-slate-800 rounded-xl border border-gray-600 overflow-hidden shadow-xl hover:border-green-500 transition-colors ${TRANSITION} ${getStepClass(s, 1)}`}>
              <div className="bg-slate-900/50 p-2 border-b border-gray-700 flex justify-between items-center">
                <span className="font-bold text-green-400 text-sm">actions</span>
                <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 rounded">FK</span>
              </div>
              <div className="p-3 space-y-1 font-mono text-[10px] text-slate-400">
                <div className="flex justify-between"><span>id</span><span className="text-slate-600">PK</span></div>
                <div className="flex justify-between text-blue-300 font-bold"><span>match_id</span><span>FK</span></div>
                <div className="flex justify-between"><span>type</span><span>enum</span></div>
                <div className="flex justify-between"><span>coords</span><span>jsonb</span></div>
              </div>
            </div>

            <div className={`absolute bottom-[20%] left-[30rem] w-56 bg-slate-800 rounded-xl border border-gray-600 overflow-hidden shadow-xl hover:border-pink-500 transition-colors ${TRANSITION} ${getStepClass(s, 1)}`}>
              <div className="bg-slate-900/50 p-2 border-b border-gray-700 flex justify-between items-center">
                <span className="font-bold text-pink-400 text-sm">players</span>
                <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 rounded">FK</span>
              </div>
              <div className="p-3 space-y-1 font-mono text-[10px] text-slate-400">
                <div className="flex justify-between"><span>id</span><span className="text-slate-600">PK</span></div>
                <div className="flex justify-between text-blue-300 font-bold"><span>match_id</span><span>FK</span></div>
                <div className="flex justify-between"><span>name</span><span>text</span></div>
                <div className="flex justify-between"><span>dorsal</span><span>int</span></div>
              </div>
            </div>
          </div>

          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl transform transition-all duration-700 z-20 ${s >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90 pointer-events-none'}`}>
            
            <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-yellow-500/30">
              <div className="bg-[#252526] px-4 py-2 flex items-center justify-between border-b border-black">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-xs text-gray-400 font-mono">supabase/security_policies.sql</span>
                <div className="text-xs text-yellow-500 font-bold flex items-center gap-1">
                  🔒 RLS ENABLED
                </div>
              </div>

              <div className="p-6 font-mono text-sm leading-relaxed text-gray-300">
                <p className="text-gray-500 italic mb-2">-- A regra de ouro: cada usuario só pode tocar o seu.</p>
                
                <div>
                  <span className="text-blue-400">CREATE POLICY</span> "Os partidos só os poden editar os donos"
                </div>
                <div>
                  <span className="text-blue-400">ON</span> <span className="text-green-400">public.matches</span>
                </div>
                <div>
                  <span className="text-blue-400">FOR SELECT USING</span> (
                </div>
                <div className="pl-4 py-1 bg-yellow-500/10 border-l-2 border-yellow-500 my-1">
                  <span className="text-purple-400">auth.uid()</span> = <span className="text-green-400">user_id</span>
                </div>
                <div>);</div>
              </div>
            </div>

            <div className="text-center mt-6">
              <p className="text-yellow-200/80 text-sm bg-yellow-900/30 inline-block px-4 py-2 rounded-full border border-yellow-500/20 backdrop-blur-sm">
                Esta única liña protexe toda a base de datos, sen necesidade de código no Backend.
              </p>
            </div>

          </div>

        </div>
      </div>
    )
  },

// 6. FLUJO DE TRABALLO
{
    id: 'workflow',
    totalSteps: 3, 
    render: (s: number) => {
      const terminalLogs = [
        "Waiting for input...",
        "git commit -m 'feat: estou presentando!' && git push origin main",
        "remote: Resolving deltas... 100% \nremote: Building project...",
        "✨ Parabéns! Despregado en https://gaeliza.dchaves.gal"
      ];

      return (
        <div className="flex flex-col justify-center h-full px-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-16 border-l-8 border-orange-500 pl-6">
            <h2 className="text-5xl font-bold text-white">Traballo durante meses</h2>
            <span className="text-orange-400 font-mono text-sm border border-orange-500/30 px-2 py-1 rounded bg-orange-900/20">Pipeline Automatizado</span>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-700 -translate-y-1/2 z-0 rounded-full"></div>
            
            <div 
              className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-orange-600 to-yellow-500 -translate-y-1/2 z-0 rounded-full transition-all duration-1000 ease-out"
              style={{ width: s === 0 ? '0%' : s === 1 ? '33%' : s === 2 ? '66%' : '100%' }}
            ></div>

            <div className="grid grid-cols-3 gap-8 relative z-10">
              
              <div className={`bg-gray-800 p-6 rounded-xl border-2 ${s >= 1 ? 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'border-gray-700'} text-center transition-all duration-500 ${getStepClass(s, 1)}`}>
                <div className="w-16 h-16 mx-auto bg-gray-700 rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg relative">
                  👨‍💻
                  {s === 1 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></span>}
                </div>
                <h3 className="text-xl font-bold text-white">1. Desenvolvemento local</h3>
                <div className="mt-3 text-sm text-gray-400 space-y-1">
                  <p>VS Code - React - Tailwind</p>
                  <p>npm run dev</p>
                </div>
              </div>

              <div className={`bg-gray-800 p-6 rounded-xl border-2 ${s >= 2 ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-gray-700'} text-center transition-all duration-500 ${getStepClass(s, 2)}`}>
                <div className="w-16 h-16 mx-auto bg-gray-700 rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg relative">
                  <span className="invert">🐙</span>
                  {s === 2 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-ping"></span>}
                </div>
                <h3 className="text-xl font-bold text-white">2. Versionado</h3>
                <div className="mt-3 text-sm text-gray-400 space-y-1">
                  <p>Control de versións con Git</p>
                  <p>Triggers automáticos</p>
                </div>
              </div>

              <div className={`bg-gray-800 p-6 rounded-xl border-2 ${s >= 3 ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-gray-700'} text-center transition-all duration-500 ${getStepClass(s, 3)}`}>
                <div className="w-16 h-16 mx-auto bg-gray-700 rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg relative">
                  🚀
                  {s === 3 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></span>}
                </div>
                <h3 className="text-xl font-bold text-white">3. Produción</h3>
                <div className="mt-3 text-sm text-gray-400 space-y-1">
                  <p>Vercel</p>
                  <p>Dominio dchaves.gal</p>
                </div>
              </div>

            </div>
          </div>

          <div className={`mt-16 bg-black/80 rounded-lg border border-gray-700 p-4 font-mono text-xs text-green-400 shadow-2xl ${TRANSITION} ${s > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex gap-2 mb-2 border-b border-gray-800 pb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-gray-500 ml-2">bash — david@developer</span>
            </div>
            <div className="min-h-[3rem] whitespace-pre-wrap">
              <span className="text-blue-400 mr-2">➜</span>
              <span className="typing-effect">{terminalLogs[s]}</span>
              <span className="animate-pulse ml-1">_</span>
            </div>
          </div>

        </div>
      );
    }
  },


   // 7. MELLORAS
   {
    id: 'roadmap',
    totalSteps: 3,
    render: (s: number) => (
      <div className="flex flex-col justify-center h-full px-16 max-w-7xl mx-auto">
        
        <div className="text-center mb-20">
          <span className="text-purple-400 font-mono text-sm tracking-[0.5em] uppercase animate-pulse">Seguintes pasos</span>
          <h2 className="text-6xl font-black text-white mt-2">
           Melloras a<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600"> futuro</span>
          </h2>
        </div>

        <div className="relative">
          <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-800 -translate-y-1/2 rounded-full"></div>
          
          <div 
            className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 -translate-y-1/2 rounded-full transition-all duration-1000 ease-in-out"
            style={{ width: s === 0 ? '0%' : s === 1 ? '16%' : s === 2 ? '50%' : '100%' }}
          ></div>

          <div className="grid grid-cols-3 gap-8 relative z-10">
            
            <div className={`group relative ${TRANSITION} ${getStepClass(s, 1)}`}>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 border border-blue-500 text-blue-400 text-[10px] font-bold px-2 py-1 rounded">v1.5</div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,1)] z-20"></div>
              
              <div className="mt-12 bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700 hover:border-blue-500 transition-colors group-hover:-translate-y-2 duration-300">
                <div className="text-4xl mb-4 bg-blue-900/30 w-fit p-3 rounded-xl">📡</div>
                <h3 className="text-xl font-bold text-white mb-2">Funcións offline</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Implementación da posibilidade de traballar coa app sen conexión e de xeito local, cunha inmediata sincronización de datos ao volver a conectarse.
                </p>
              </div>
            </div>

            <div className={`group relative ${TRANSITION} ${getStepClass(s, 2)}`}>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 border border-purple-500 text-purple-400 text-[10px] font-bold px-2 py-1 rounded">v2.0</div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full shadow-[0_0_20px_rgba(168,85,247,1)] z-20"></div>

              <div className="mt-12 bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700 hover:border-purple-500 transition-colors group-hover:-translate-y-2 duration-300">
                <div className="text-4xl mb-4 bg-purple-900/30 w-fit p-3 rounded-xl">🧠</div>
                <h3 className="text-xl font-bold text-white mb-2">Analítica profunda e predictiva</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Uso de algoritmos, ML e IA para conseguir análises máis profundos e predecir resultados ou desempeños individuais.
                </p>
              </div>
            </div>

            <div className={`group relative ${TRANSITION} ${getStepClass(s, 3)}`}>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 border border-pink-500 text-pink-400 text-[10px] font-bold px-2 py-1 rounded">v. ¿ ?</div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-pink-500 rounded-full shadow-[0_0_20px_rgba(236,72,153,1)] z-20"></div>

              <div className="mt-12 bg-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-700 hover:border-pink-500 transition-colors group-hover:-translate-y-2 duration-300">
                <div className="text-4xl mb-4 bg-pink-900/30 w-fit p-3 rounded-xl">🌍</div>
                <h3 className="text-xl font-bold text-white mb-2">Plataforma escalable</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Todos soñamos cunha aplicación que todo o mundo use... Por que non facelo con esta?
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  },

  // 8. DEMO
  {
    id: 'pre-demo',
    totalSteps: 1, 
    render: (s: number) => (
      <div className="flex flex-col items-center justify-center h-full px-16 max-w-7xl mx-auto relative overflow-hidden">
        
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>

        <div className="relative z-10 text-center space-y-12">
          
          <div className="inline-block animate-bounce mb-4">
            <span className="text-6xl filter drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">👀</span>
          </div>

          <h2 className="text-7xl font-black text-white tracking-tight">
            Menos diapositivas.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Máis Acción.</span>
          </h2>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Vexamos como <strong>Gaeliza</strong> xestiona un partido real dende a perspectiva dun usuario.
          </p>

          <div className={`pt-10 ${TRANSITION} ${getStepClass(s, 1)}`}>
            <button 
              onClick={() => window.open('/', '_blank')}
              className="group relative px-12 py-6 bg-white text-black rounded-2xl font-black text-2xl hover:scale-105 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-[0_0_80px_rgba(255,255,255,0.5)] flex items-center gap-4 mx-auto overflow-hidden"
            >
              <span className="group-hover:rotate-12 transition-transform duration-300">⚡</span>
              <span>ABRIR APLICACIÓN</span>
              
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
            </button>
            
            <p className="mt-6 text-xs font-mono text-gray-600 uppercase tracking-widest">
              Entorno de Produción • Datos Reais
            </p>
          </div>

        </div>
      </div>
    )
  },

// 9. CONCLUSIÓM
{
    id: 'conclusiones',
    totalSteps: 2, 
    render: (s: number) => (
      <div className="flex flex-col items-center justify-center h-full px-16 max-w-7xl mx-auto relative overflow-hidden">
        
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/10 via-transparent to-transparent pointer-events-none"></div>
        
        <h2 className="text-7xl font-black text-white mb-20 relative z-10 tracking-tight">
          Reflexións <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Finais</span>
        </h2>
        
        <div className="grid grid-cols-3 gap-6 w-full relative z-10">
          <div 
            className={`bg-gray-800/40 backdrop-blur-md p-8 rounded-3xl border border-gray-700/50 hover:bg-gray-800/60 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 group ${TRANSITION} ${getStepClass(s, 1)}`}
            style={{ transitionDelay: '0ms' }}
          >
            <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6 text-blue-400 group-hover:scale-110 transition-transform">🧠</div>
            <h3 className="text-xl font-bold text-white mb-3">Desafío</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Tecnoloxías novas, datos pouco curados, tempo escaso...
            </p>
          </div>

          <div 
            className={`bg-gradient-to-b from-gray-800/60 to-gray-900/60 backdrop-blur-md p-8 rounded-3xl border border-gray-600 hover:border-green-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl group relative overflow-hidden ${TRANSITION} ${getStepClass(s, 1)}`}
            style={{ transitionDelay: '150ms' }}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl grayscale group-hover:grayscale-0 transition-all">🎯</div>
            <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6 text-green-400 group-hover:scale-110 transition-transform relative z-10">❤️</div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">Valor real</h3>
            <p className="text-gray-400 text-sm leading-relaxed relative z-10">
              Satisfacción por crear unha solución a un problema real, aínda máis, no meu mundo.
            </p>
          </div>

          <div 
            className={`bg-gray-800/40 backdrop-blur-md p-8 rounded-3xl border border-gray-700/50 hover:bg-gray-800/60 hover:border-purple-500/50 transition-all duration-500 hover:-translate-y-2 group ${TRANSITION} ${getStepClass(s, 1)}`}
            style={{ transitionDelay: '300ms' }}
          >
            <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6 text-purple-400 group-hover:scale-110 transition-transform">✨</div>
            <h3 className="text-xl font-bold text-white mb-3">Poder do desenvolvemento</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Entender que o código é un medio xenial para desenvolver ideas que temos na cabeza.
            </p>
          </div>
        </div>

        <div className={`mt-24 flex flex-col items-center gap-8 ${TRANSITION} ${getStepClass(s, 2)}`}>
          
          <div className="flex items-center gap-6">
            <a 
              href="https://github.com/davidchavesrodriguez/gaeliza" 
              target="_blank" 
              rel="noreferrer" 
              className="px-6 py-3 rounded-full border border-gray-600 text-gray-400 hover:text-white hover:border-white hover:bg-white/5 transition-all text-sm font-bold flex items-center gap-2"
            >
              <span>📂</span> Ver Código
            </a>

            <button 
              onClick={() => navigate('/')}
              className="group relative px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-lg shadow-[0_0_40px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_rgba(37,99,235,0.7)] hover:scale-105 transition-all duration-300 flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span>🚀</span>
              <span>LANZAR DEMO</span>
            </button>
          </div>

          <div className="text-center mt-8">
            <p className="text-2xl font-bold text-white mb-1">Moitas grazas.</p>
            <p className="text-gray-500 text-sm font-mono">Quenda de Preguntas?</p>
          </div>

        </div>
      </div>
    )
  }
  ];

  // --- NAVEGACIÓN ---
  const currentSlide = slides[slideIndex];

  const goNext = () => {
    if (stepIndex < currentSlide.totalSteps) {
      setStepIndex(s => s + 1);
    } else if (slideIndex < slides.length - 1) {
      setSlideIndex(s => s + 1);
      setStepIndex(0);
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      setStepIndex(s => s - 1);
    } else if (slideIndex > 0) {
      const prevIndex = slideIndex - 1;
      setSlideIndex(prevIndex);
      setStepIndex(slides[prevIndex].totalSteps);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'Enter', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'f') toggleFullScreen();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [slideIndex, stepIndex]);

  return (
    <div 
      className="w-screen h-screen bg-gray-900 text-gray-100 overflow-hidden relative selection:bg-blue-500/30 font-sans outline-none"
      onClick={goNext}
    >
      
      <div key={slideIndex} className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {currentSlide.render(stepIndex)}
      </div>

      <div className="absolute bottom-0 left-0 h-1.5 bg-gray-800 w-full z-40">
         <div 
           className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
           style={{ width: `${((slideIndex + 1) / slides.length) * 100}%` }}
         ></div>
      </div>

      <div 
        className="fixed bottom-6 right-6 flex items-center gap-4 bg-gray-800/90 backdrop-blur px-4 py-2 rounded-full border border-gray-700 shadow-xl z-50"
        onClick={(e) => e.stopPropagation()} 
      >
        <button 
          onClick={goPrev} 
          disabled={slideIndex === 0 && stepIndex === 0} 
          className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white disabled:opacity-30 transition-all"
          title="Anterior (Flecha Izquierda)"
        >
          ◀
        </button>
        
        <span className="font-mono text-sm text-gray-300 min-w-[3rem] text-center font-bold">
          {slideIndex + 1} / {slides.length}
        </span>
        
        <button 
          onClick={goNext} 
          disabled={slideIndex === slides.length - 1 && stepIndex === currentSlide.totalSteps} 
          className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white disabled:opacity-30 transition-all"
          title="Seguinte (Espazo / Enter)"
        >
          ▶
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1"></div>

        <button 
          onClick={toggleFullScreen}
          className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-all"
          title="Pantalla Completa (Tecla F)"
        >
          ⛶
        </button>
      </div>
    </div>
  );
}