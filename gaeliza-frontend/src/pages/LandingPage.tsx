import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import landingImage from '../assets/landingImage.png';

export default function LandingPage({ session }: { session: Session | null }) {
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">

            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-3xl">🏐</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                        Gaeliza
                    </span>
                </div>
                <div className="flex gap-4">
                    <Link
                        to={session ? "/dashboard" : "/login"}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {session ? 'Ir ao Panel' : 'Acceder / Rexistro'}
                    </Link>
                </div>
            </nav>

            <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 flex flex-col-reverse lg:flex-row items-center gap-12">
                <div className="lg:w-1/2 text-center lg:text-left">
                    <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-6">
                        O Fútbol Gaélico<br />
                        <span className="text-indigo-400">agora é dixital</span>
                    </h1>
                    <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                        Esquece o papel e o boli. Gaeliza é a ferramenta definitiva para adestradores e xogadores.
                        Analiza partidos, xera informes e leva o teu equipo ao seguinte nivel.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                        <Link
                            to={session ? "/dashboard" : "/login"}
                            className="px-8 py-4 bg-white text-gray-900 rounded-lg font-bold hover:bg-gray-100 transition-colors text-lg"
                        >
                            Comezar agora
                        </Link>
                        <a
                            href="#features"
                            className="px-8 py-4 border border-gray-700 rounded-lg font-medium hover:bg-gray-800 transition-colors text-lg"
                        >
                            Saber máis
                        </a>
                    </div>
                </div>

                <div className="lg:w-1/2 relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>

                    <div className="relative bg-gray-800 aspect-video rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden shadow-2xl">

                        <img
                            src={landingImage}
                            alt="Captura de Gaeliza"
                            className="w-full h-full object-cover object-top transition-transform duration-500"
                        />

                    </div>
                </div>
            </header>

            <section id="features" className="bg-gray-800/50 py-20 border-y border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Todo o que necesitas</h2>
                        <p className="text-gray-400">Deseñado especificamente para as necesidades do deporte rei en Irlanda</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 hover:border-indigo-500/50 transition-colors">
                            <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center text-2xl mb-6 text-indigo-400">
                                ⚡
                            </div>
                            <h3 className="text-xl font-bold mb-3">Análise en tempo real</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Rexistra goles, puntos, faltas e tarxetas ao instante cun sistema de botóns intuitivo. Di adeus ás follas de cálculo.
                            </p>
                        </div>

                        <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 hover:border-indigo-500/50 transition-colors">
                            <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center text-2xl mb-6 text-indigo-400">
                                📄
                            </div>
                            <h3 className="text-xl font-bold mb-3">Informes PDF</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Xera automaticamente un informe visual do partido para compartir co corpo técnico ou cos xogadores ao rematar o encontro.
                            </p>
                        </div>

                        <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 hover:border-indigo-500/50 transition-colors">
                            <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center text-2xl mb-6 text-indigo-400">
                                📱
                            </div>
                            <h3 className="text-xl font-bold mb-3">Accesible e móbil</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Unha Web App moderna que funciona no teu móbil, tablet ou ordenador. Leva as estatísticas no peto a calquer lugar.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 max-w-4xl mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold mb-8">Sobre o proxecto</h2>
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl border border-gray-700">
                    <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                        Son <strong className="text-white">David Chaves</strong>, desenvolvedor web e apaixonado do fútbol gaélico.
                        Creei <strong>Gaeliza</strong> para acabar cos papeis emborronados e axudar a dixitalizar este deporte en auxe en Galicia.
                    </p>
                    <div className="flex justify-center gap-6">
                        <a href="https://gaelicogalego.gal/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                            Asociación Galega
                        </a>
                        <a href="https://www.linkedin.com/in/chaves19/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                            O meu LinkedIn
                        </a>
                        <a href="https://github.com/davidchavesrodriguez/gaeliza" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                            Repositorio da web
                        </a>
                    </div>
                </div>
            </section>

            <footer className="bg-gray-900 text-center py-8 mt-12 border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              
              <div className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()} Gaeliza. <span className="text-gray-400 font-medium">Licenza MIT</span>
              </div>
              
              <div className="flex space-x-6">
                
                <a 
                  href="https://github.com/davidchavesrodriguez/gaeliza" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-500 hover:text-white transition-colors transform hover:scale-110"
                  aria-label="GitHub Repo"
                  title="Repositorio do Proxecto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36.5-8 0C6.72 2 2 4 2 6c-.28 1.15-.28 2.35 0 3.5A5.403 5.403 0 0 0 1 13c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                    <path d="M9 18c-4.51 2-5-2-7-2"/>
                  </svg>
                </a>

                <a 
                  href="https://www.linkedin.com/in/chaves19/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-500 hover:text-blue-400 transition-colors transform hover:scale-110"
                  aria-label="LinkedIn"
                  title="LinkedIn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                    <rect width="4" height="12" x="2" y="9"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                </a>

                <a 
                  href="mailto:19.dchaves@gmail.com" 
                  className="text-gray-500 hover:text-red-400 transition-colors transform hover:scale-110"
                  aria-label="Email"
                  title="Contactar por correo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </a>

              </div>
            </div>
          </div>
        </footer>
        </div>
    );
}