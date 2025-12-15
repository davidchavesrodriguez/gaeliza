import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

/**
 * Compoñente de Autenticación.
 * Xestiona o fluxo de inicio de sesión e rexistro de novos usuarios.
 * Inclúe a creación do perfil público durante o proceso de rexistro e notificacións de estado na UI.
 */
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  /**
   * Procesa o envío do formulario.
   * Discrimina entre as accións de rexistro e inicio de sesión baseándose no estado actual.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isRegistering) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
        });

        if (authError) throw authError;

        if (authData.user) {
           const { error: profileError } = await supabase
             .from('profiles') 
             .update({ username: username }) 
             .eq('id', authData.user.id); 
           
           if (profileError) {
             console.warn("Erro ao establecer o nome de perfil:", profileError.message);
           }
        } else {
           console.warn("Datos do usuario non dispoñibles tras o rexistro.");
        }

        setSuccessMessage('Conta creada correctamente! Por favor, revisa o teu correo electrónico para activala antes de iniciar sesión.');
        setIsRegistering(false);

      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (loginError) throw loginError;
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Detalles do erro de autenticación:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Alterna entre os modos de rexistro e inicio de sesión, limpando mensaxes previas.
   */
  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1120] text-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      <div className="absolute top-6 left-6 z-20">
        <Link 
          to="/" 
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-all duration-300 group"
        >
          <div className="p-2 bg-gray-800/50 rounded-full border border-gray-700 group-hover:border-blue-500/50 group-hover:bg-blue-600/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </div>
          <span className="font-medium text-sm">Volver</span>
        </Link>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-xl mb-6 transform hover:scale-105 transition-transform duration-300">
            🏐
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white tracking-tight">
            {isRegistering ? 'Crea a túa conta' : 'Benvido de novo'}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {isRegistering ? 'Únete á comunidade do Gaélico dixital' : 'Introduce as túas credenciais para acceder'}
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-700/50">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            <div className="space-y-4">
                
              {isRegistering && (
                <div className="relative animate-in slide-in-from-top-4 fade-in duration-300">
                  <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                    Nome de usuario
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required={isRegistering}
                      placeholder="Ex: chaves19"
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded-lg leading-5 bg-gray-700/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="ti@exemplo.com"
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded-lg leading-5 bg-gray-700/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Contrasinal
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isRegistering ? "new-password" : "current-password"}
                    required
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded-lg leading-5 bg-gray-700/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {error && (
                <div className="rounded-lg bg-red-900/30 border border-red-500/50 p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-red-400 mt-0.5">⚠️</div>
                  <div className="text-sm text-red-200">{error}</div>
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg bg-green-900/30 border border-green-500/50 p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-green-400 mt-0.5">✅</div>
                  <div className="text-sm text-green-200">{successMessage}</div>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/25 transform hover:-translate-y-0.5"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? 'Procesando...' : isRegistering ? 'Crear Conta' : 'Entrar'}
              </button>
            </div>

            <div className="text-center mt-4">
              <p className="text-sm text-gray-400">
                {isRegistering ? 'Xa tes unha conta?' : 'Aínda non tes conta?'}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="ml-2 font-medium text-blue-400 hover:text-blue-300 focus:outline-none transition-colors hover:underline"
                >
                  {isRegistering ? 'Inicia sesión' : 'Rexístrate gratis'}
                </button>
              </p>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}