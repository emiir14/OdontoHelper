import React, { useEffect, useState } from 'react';
import { Lock, Mail, User, ShieldCheck, Cpu, HardDrive, RotateCw, Database } from 'lucide-react';
import {
  BackendHealth,
  neonFetch,
  probeBackendHealth,
  setNeonSession,
} from '../adapters/neon/neonClient';
import { getSupabaseClient, isSupabaseConfigured } from '../adapters/supabase/supabaseClient';
import { OdontoHelperLogo } from './Sidebar';

interface SupabaseAuthViewProps {
  onAuthenticated: () => void;
}

export const SupabaseAuthView: React.FC<SupabaseAuthViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);

  const supaReady = isSupabaseConfigured();

  useEffect(() => {
    probeBackendHealth().then(setHealth).catch(() => {});
  }, []);

  const syncSupabaseToNeonIfEnabled = async (accessToken?: string | null) => {
    if (!accessToken) return;
    const latestHealth = health || (await probeBackendHealth());
    if (!latestHealth.neonConfigured) return;
    try {
      const synced = await neonFetch<{
        token: string;
        user?: { email?: string };
      }>('/api/auth/neon', {
        method: 'POST',
        body: JSON.stringify({
          action: 'supabase-sync',
          supabaseAccessToken: accessToken,
        }),
      });
      if (synced?.token) {
        setNeonSession(synced.token, synced.user?.email || email.trim());
      }
    } catch {
      // If Neon sync fails while Supabase works, Supabase Auth remains functional
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (supaReady) {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase no está disponible.');

        if (mode === 'reset') {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setInfoMsg(
            'Te enviamos un correo con el enlace para restablecer tu contraseña.'
          );
          setMode('login');
          return;
        }

        if (mode === 'login') {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw error;
          await syncSupabaseToNeonIfEnabled(data.session?.access_token);
          onAuthenticated();
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          await syncSupabaseToNeonIfEnabled(data.session.access_token);
          onAuthenticated();
        } else {
          setInfoMsg(
            'Cuenta creada. Revisá tu casilla de correo para confirmar el acceso e iniciá sesión.'
          );
          setMode('login');
        }
        return;
      }

      // Neon PostgreSQL + Vercel Serverless Auth flow
      if (mode === 'reset') {
        setInfoMsg(
          'Para restablecer una cuenta en Neon, contactá al administrador del consultorio o creá una nueva cuenta.'
        );
        setMode('login');
        return;
      }

      const res = await neonFetch<{
        token: string;
        user: { email: string; fullName: string };
      }>('/api/auth/neon', {
        method: 'POST',
        body: JSON.stringify({
          action: mode === 'signup' ? 'signup' : 'login',
          email: email.trim(),
          password,
          fullName: fullName.trim(),
        }),
      });

      setNeonSession(res.token, res.user.email);
      onAuthenticated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo autenticar.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const stackLabel =
    supaReady && health?.neonConfigured
      ? 'Supabase Auth + Neon PostgreSQL · Vercel'
      : supaReady
      ? 'Supabase Auth · Vercel'
      : 'Neon PostgreSQL · Vercel';

  return (
    <div className="min-h-dvh bg-[#EDEFEA] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <OdontoHelperLogo />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
            <Database className="w-3.5 h-3.5" />
            <span>{stackLabel}</span>
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {mode === 'login'
              ? 'Ingresá a tu consultorio'
              : mode === 'signup'
              ? 'Creá tu cuenta clínica'
              : 'Recuperar contraseña'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Tus historias clínicas, odontogramas, presupuestos, pagos y agenda de turnos por profesional se guardan de forma segura en la nube.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>Las grabaciones de audio e imágenes clínicas viven solo en tu navegador.</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>La transcripción con Whisper se procesa localmente en tu equipo.</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-800 dark:text-teal-200">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nombre del odontólogo / consultorio
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dra. Sofía Martínez"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="consultorio@odontologia.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Contraseña
                </label>
                {supaReady && mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            {loading ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {mode === 'login'
                    ? 'Iniciar sesión'
                    : mode === 'signup'
                    ? 'Crear cuenta'
                    : 'Enviar enlace de recuperación'}
                </span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'));
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline"
          >
            {mode === 'login'
              ? '¿Primera vez? Creá una cuenta para tu consultorio'
              : '¿Ya tenés cuenta? Iniciá sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};
