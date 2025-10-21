import { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.error_description || error.message);
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
     e.preventDefault();
     setLoading(true);
     setMessage('');

     const { error } = await supabase.auth.signUp({ email, password });

     if (error) {
       setMessage(error.error_description || error.message);
     } else {
         setMessage('¡Revisa tu email para verificar la cuenta!');
     }
     setLoading(false);
  };

  return (
    <div className="auth-widget">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading ...' : 'Login'}
        </button>
      </form>

      <button onClick={handleSignUp} disabled={loading}>
        {loading ? 'Loading ...' : 'Sign Up'}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}