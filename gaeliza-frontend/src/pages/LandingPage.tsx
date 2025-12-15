import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import landingImage from '../assets/landingImage.png';

export default function LandingPage({ session }: { session: Session | null }) {
    return (
        <div className="min-h-screen bg-[#0B1120] text-gray-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
            
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] opacity-50"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] opacity-50"></div>
            </div>

            <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0B1120]/80 backdrop-blur-md transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3 group cursor-default">
                        <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                            <span className="text-xl">🏐</span>
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent tracking-tight">
                            Gaeliza
                        </span>
                    </div>
                    <div className="flex gap-4">
                        <Link
                            to={session ? "/dashboard" : "/login"}
                            className="relative inline-flex items-center justify-center px-6 py-2.5 overflow-hidden font-medium text-white transition duration-300 ease-out bg-blue-600 rounded-full shadow-lg group hover:ring-4 hover:ring-blue-500/30"
                        >
                            <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700"></span>
                            <span className="relative flex items-center gap-2">
                                {session ? (
                                    <><span>📊</span> Ir ao Panel</>
                                ) : (
                                    <><span>🔒</span> Acceder</>
                                )}
                            </span>
                        </Link>
                    </div>
                </div>
            </nav>

            <header className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 flex flex-col-reverse lg:flex-row items-center gap-16">
                <div className="lg:w-1/2 text-center lg:text-left space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
                    
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                        V 1.0 Lanzamento
                    </div>

                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight text-white">
                        O Fútbol Gaélico <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                            agora é dixital
                        </span>
                    </h1>
                    
                    <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                        Esquece o papel, boli e as aburridas follas de cálculo. Gaeliza é unha ferramenta pioneira no análise de fútbol gáelico para Galicia.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                        <Link
                            to={session ? "/dashboard" : "/login"}
                            className="px-8 py-4 bg-white text-gray-900 rounded-xl font-bold hover:bg-gray-200 transition-all transform hover:-translate-y-1 shadow-xl hover:shadow-2xl flex items-center justify-center gap-2"
                        >
                            <span>🚀</span> Comezar agora
                        </Link>
                        <a
                            href="#features"
                            className="px-8 py-4 border border-gray-700 rounded-xl font-bold text-gray-300 hover:bg-gray-800 hover:text-white transition-all hover:border-gray-500 flex items-center justify-center gap-2"
                        >
                            <span>👇</span> Saber máis
                        </a>
                    </div>
                </div>

                <div className="lg:w-1/2 relative perspective-1000 animate-in slide-in-from-right-8 fade-in duration-1000 delay-200">
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2rem] blur-2xl opacity-20 animate-pulse"></div>
                    <div className="relative transform transition-transform duration-500 hover:scale-[1.02] hover:rotate-1">
                        <div className="rounded-2xl border-4 border-gray-800 bg-gray-900 shadow-2xl overflow-hidden aspect-video">
                            <div className="h-6 bg-gray-800 flex items-center gap-2 px-4 border-b border-gray-700">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
                            </div>
                            <img
                                src={landingImage}
                                alt="Dashboard de Gaeliza"
                                className="w-full h-full object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/20 to-transparent pointer-events-none"></div>
                        </div>
                    </div>
                </div>
            </header>

            <section id="features" className="py-24 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl font-bold mb-6 text-white">Todo o que necesitas</h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Unha ferramenta feita en Galicia para as necesidades específicas do noso deporte.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="group bg-gray-800/40 backdrop-blur-sm p-8 rounded-3xl border border-gray-700/50 hover:border-blue-500/50 hover:bg-gray-800/60 transition-all duration-300 hover:-translate-y-2">
                            <div className="w-14 h-14 bg-blue-900/30 rounded-2xl flex items-center justify-center text-3xl mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                                ⚡
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">Análise en tempo real</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Rexistra goles, puntos, faltas e tarxetas ao instante. Analiza os teus partidos en directo ou ao rematar.
                            </p>
                        </div>

                        <div className="group bg-gray-800/40 backdrop-blur-sm p-8 rounded-3xl border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-800/60 transition-all duration-300 hover:-translate-y-2">
                            <div className="w-14 h-14 bg-purple-900/30 rounded-2xl flex items-center justify-center text-3xl mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                                📄
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">Informes PDF</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Exporta o teu análise a PDF cun click. Comparte fácilmente os teus análises cos teus compañeiros ou xogadores.
                            </p>
                        </div>

                        <div className="group bg-gray-800/40 backdrop-blur-sm p-8 rounded-3xl border border-gray-700/50 hover:border-green-500/50 hover:bg-gray-800/60 transition-all duration-300 hover:-translate-y-2">
                            <div className="w-14 h-14 bg-green-900/30 rounded-2xl flex items-center justify-center text-3xl mb-6 text-green-400 group-hover:scale-110 transition-transform">
                            📈
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">En desenvolvemento constante</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Novas funcionalidades e melloras sempre en camiño. As suxerencias son totalmente aceptadas!
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gray-800/30 skew-y-3 transform origin-top-left -z-10"></div>
                
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <span className="text-blue-400 font-bold tracking-widest uppercase text-sm mb-2 block">O desenvolvedor</span>
                    <h2 className="text-3xl font-bold mb-10 text-white">Detrás do código</h2>
                    
                    <div className="bg-[#161b22] p-1 rounded-2xl border border-gray-700 shadow-2xl inline-block max-w-2xl w-full">
                        <div className="bg-[#0d1117] rounded-xl p-8 md:p-12 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                            
                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-gradient-to-tr from-gray-700 to-gray-600 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl border-4 border-[#161b22] shadow-lg">
                                    👨‍💻
                                </div>
                                <p className="text-gray-300 text-lg mb-8 leading-relaxed font-light">
                                    "Son <strong className="text-white font-bold">David Chaves Rodríguez</strong>, desenvolvedor web e xogador de fútbol gaélico. 
                                    Este proxecto nace ante a nula dixitalicación dun deporte que tanto análise precisa coma é o fútbol gaélico.
                                    Espero que sirva para darlle un empurrón ao xa crecente auxe no que se encontra no noso país!"
                                </p>
                                
                                <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
                                    <a href="https://gaelicogalego.gal/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-blue-400">
                                        <span>🌍</span> Asociación Galega
                                    </a>
                                    <a href="https://www.linkedin.com/in/chaves19/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-[#0077b5] hover:text-white transition-colors text-gray-300">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                                        LinkedIn
                                    </a>
                                    <a href="https://github.com/davidchavesrodriguez/gaeliza" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-[#333] hover:text-white transition-colors text-gray-300">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                        GitHub Repo
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="border-t border-gray-800 bg-[#0B1120] pt-12 pb-8">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <div className="flex justify-center items-center gap-2 mb-4 opacity-50">
                        <span className="text-2xl">🏐</span>
                        <span className="font-bold">Gaeliza</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-8">
                        &copy; {new Date().getFullYear()}<br/>
                        <span className="text-gray-600 text-xs">Licenza MIT • Proxecto TFC</span>
                    </p>
                </div>
            </footer>
        </div>
    );
}