import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      setShowLoadingScreen(true);
      setTimeout(() => {
  window.location.href = '/#/app/mapa';
  window.location.reload();
}, 700);
    } catch (err) {
      console.error(err);
      toast.error('Correo o contraseña incorrectos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {showLoadingScreen && <LoadingScreen />}

      <div className="login-page min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="login-waves absolute inset-0 z-0" />

        <div className="w-full max-w-md z-10">
          <h1 className="text-center text-4xl font-bold text-white mb-8">
            Agrícola Moray
          </h1>

          <div className="bg-[#1A1A1A] p-8 rounded-lg">
            <form onSubmit={handleLogin} className="space-y-6" autoComplete="on">
              <div>
                <label htmlFor="email" className="block text-sm text-white mb-1">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#262626] border border-[#404040] rounded-md p-2 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm text-white mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[#262626] border border-[#404040] rounded-md p-2 pr-10 text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {isLoading ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}