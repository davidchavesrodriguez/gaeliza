import { useState, type FormEvent } from 'react';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 py-20 px-6">
      <div className="w-full sm:max-w-xl lg:max-w-2xl space-y-8 bg-gray-800 p-10 rounded-2xl shadow-2xl border border-gray-700">
        
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            {isRegistering ? 'Crear conta' : 'Iniciar sesión'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Dámosche a benvida a Gaeliza! 🏐
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          
          <div className="rounded-md shadow-sm -space-y-px">
            {isRegistering && (
              <div>
                <label htmlFor="username" className="sr-only">Nome de usuario</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 bg-gray-700 placeholder-gray-400 text-white rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                  placeholder="Nome de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="sr-only">Correo electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 bg-gray-700 placeholder-gray-400 text-white ${isRegistering ? '' : 'rounded-t-md'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors`}
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">Contrasinal</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 bg-gray-700 placeholder-gray-400 text-white rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                placeholder="Contrasinal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Área de mensaxes de estado (Erro e Éxito) */}
          <div className="space-y-2">
            {error && (
              <div className="rounded-md bg-red-900/50 border border-red-800 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-300">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="rounded-md bg-green-900/50 border border-green-800 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-300">{successMessage}</h3>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Procesando...' : isRegistering ? 'Rexistrarse' : 'Iniciar sesión'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-blue-400 hover:text-blue-300 focus:outline-none transition-colors hover:underline"
            >
              {isRegistering
                ? 'Xa tes conta? Inicia sesión'
                : 'Non tes conta? Rexístrate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}