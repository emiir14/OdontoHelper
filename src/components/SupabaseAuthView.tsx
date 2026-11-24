import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RotateCw,
  User,
} from 'lucide-react';
import {
  signInWithTestCredentials,
  startLocalTrialSession,
} from '../core/auth/testAuth';
import {
  calculatePlanPricing,
  getCycleDisplayLabel,
  getPlanDefinition,
  getTierDisplayLabel,
} from '../core/clinic/subscriptionPlans';
import { PaidSubscriptionPlanTier, SubscriptionBillingCycle } from '../core/types';
import { getSupabaseClient, isSupabaseConfigured } from '../adapters/supabase/supabaseClient';
import { Button } from './ui/Button';

interface SupabaseAuthViewProps {
  onAuthenticated: () => void;
  initialMode?: 'login' | 'signup';
  initialPlan?: PaidSubscriptionPlanTier | null;
  initialCycle?: SubscriptionBillingCycle | null;
  onBackToLanding?: () => void;
}

function formatAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : '';
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Usuario o contraseña incorrectos. Verificá tus datos e intentá nuevamente.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirmá tu correo electrónico desde el enlace que te enviamos antes de iniciar sesión.';
  }
  if (lower.includes('user already registered')) {
    return 'Ya existe una cuenta registrada con este correo electrónico.';
  }
  if (lower.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Demasiados intentos en pocos minutos. Esperá un momento antes de volver a intentar.';
  }
  return raw || 'No pudimos iniciar sesión. Verificá tus credenciales e intentá nuevamente.';
}

export const SupabaseAuthView: React.FC<SupabaseAuthViewProps> = ({
  onAuthenticated,
  initialMode = 'login',
  initialPlan = null,
  initialCycle = null,
  onBackToLanding,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setInfoMsg(null);
  }, [initialMode]);

  const cloudAuthReady = isSupabaseConfigured();
  const activePlan =
    initialPlan && getPlanDefinition(initialPlan).available ? initialPlan : 'base';
  const activeCycle = initialCycle || 'annual';
  const selectedPricing = calculatePlanPricing(activePlan, activeCycle);

  const handleFillTestUser = () => {
    setMode('login');
    setEmail('drtest');
    setPassword('test');
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (mode === 'login' && signInWithTestCredentials(email, password)) {
        onAuthenticated();
        return;
      }

      if (!cloudAuthReady) {
        if (mode === 'signup') {
          startLocalTrialSession({
            email: email.trim(),
            fullName: fullName.trim() || email.split('@')[0],
            intendedPlan: activePlan,
            intendedCycle: activeCycle,
          });
          onAuthenticated();
          return;
        }
        throw new Error('Usuario o contraseña incorrectos. Verificá tus datos e intentá nuevamente.');
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('El servicio de acceso no está disponible en este momento.');
      }

      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfoMsg('Te enviamos un correo con el enlace para restablecer tu contraseña.');
        setMode('login');
        return;
      }

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onAuthenticated();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim() || email.split('@')[0],
            intended_plan: activePlan,
            intended_cycle: activeCycle,
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        onAuthenticated();
      } else {
        setInfoMsg(
          'Cuenta creada con 7 días de prueba gratuita. Revisá tu casilla de correo para confirmar tu acceso e iniciá sesión.'
        );
        setMode('login');
      }
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const heading =
    mode === 'login'
      ? 'Iniciar sesión'
      : mode === 'signup'
      ? 'Comenzá tu prueba gratis de 7 días'
      : 'Recuperar contraseña';

  const subtitle =
    mode === 'login'
      ? 'Ingresá tus credenciales para acceder a tu consultorio.'
      : mode === 'signup'
      ? 'Creá tu consultorio en menos de un minuto. Sin tarjeta ni compromiso de compra.'
      : 'Ingresá tu correo electrónico y te enviaremos un enlace de recuperación.';

  const authInputClass =
    'w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-500 transition-colors';

  return (
    <div className="min-h-dvh grid lg:grid-cols-12 bg-[#F8F9F5] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Left Brand Showcase Column (Desktop) */}
      <aside className="hidden lg:flex lg:col-span-5 xl:col-span-5 flex-col justify-between p-10 xl:p-14 bg-[#0D2B2D] text-white relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-teal-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -left-24 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center text-white shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path
                d="M16 4.5C11.2 4.5 8 7.5 8 12.2C8 16.5 9.8 19.8 10.9 24.4C11.5 26.8 12.7 27.8 13.9 27.8C15 27.8 15.5 25.4 16 23.8C16.5 25.4 17 27.8 18.1 27.8C19.3 27.8 20.5 26.8 21.1 24.4C22.2 19.8 24 16.5 24 12.2C24 7.5 20.8 4.5 16 4.5Z"
                fill="currentColor"
                fillOpacity="0.22"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">OdontoHelper</span>
        </div>

        <div className="relative z-10 max-w-md space-y-8 my-auto py-10">
          <div className="space-y-3">
            <h2 className="text-3xl xl:text-[34px] font-bold tracking-tight leading-[1.15] text-white text-balance">
              Tu consultorio odontológico, ordenado desde la primera consulta.
            </h2>
            <p className="text-sm text-teal-100/75 leading-relaxed">
              Centralizá historias clínicas, odontograma, agenda, presupuestos y seguimiento financiero en una herramienta pensada para la práctica diaria en Uruguay.
            </p>
          </div>

          <div className="divide-y divide-white/10 border-t border-white/10">
            <div className="py-4 space-y-1">
              <div className="text-sm font-semibold text-white">7 días de prueba completa</div>
              <p className="text-xs text-teal-100/70 leading-relaxed">
                Probá todas las funciones en tu consultorio antes de elegir entre el Plan Profesional o el Plan Extra.
              </p>
            </div>
            <div className="py-4 space-y-1">
              <div className="text-sm font-semibold text-white">Dictado por voz e historia clínica</div>
              <p className="text-xs text-teal-100/70 leading-relaxed">
                Registrá evoluciones, anamnesis, odontograma y control de encías en segundos entre turno y turno.
              </p>
            </div>
            <div className="py-4 space-y-1">
              <div className="text-sm font-semibold text-white">Activación directa en USD</div>
              <p className="text-xs text-teal-100/70 leading-relaxed">
                Cuando decidas continuar, transferís en USD desde BROU, Santander, Itaú, BBVA o Prex con descuento trimestral o anual.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-teal-100/50">
          OdontoHelper Uruguay · Gestión Clínica Odontológica
        </div>
      </aside>

      {/* Right Authentication Column */}
      <main className="lg:col-span-7 flex flex-col justify-between px-5 py-6 sm:px-10 sm:py-8">
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between gap-3">
          {onBackToLanding ? (
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al inicio</span>
            </button>
          ) : (
            <div className="lg:hidden flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              OdontoHelper
            </div>
          )}

          <span className="text-xs text-slate-400 dark:text-slate-500">
            Acceso privado del profesional
          </span>
        </div>

        {/* Centered Clean Form Surface */}
        <div className="w-full max-w-[400px] mx-auto my-auto py-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {heading}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {mode === 'signup' && (
            <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/35 border border-teal-200/80 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-100 space-y-1">
              <div className="font-semibold">
                Prueba gratis 7 días · luego {getTierDisplayLabel(activePlan)} ({getCycleDisplayLabel(activeCycle)})
              </div>
              <p className="text-[11px] text-teal-800/80 dark:text-teal-200/80 tabular-nums">
                Referencia estimada post-prueba: USD {selectedPricing.effectiveMonthlyUsd}/mes
                {selectedPricing.discountPct > 0 ? ` (${selectedPricing.discountPct}% OFF aplicado)` : ''}. Pago únicamente en USD por transferencia bancaria.
              </p>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 text-xs text-teal-800 dark:text-teal-200"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nombre y apellido del odontólogo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dra. Sofía Martínez"
                    className={authInputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-identifier"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {mode === 'login' ? 'Usuario o correo electrónico' : 'Correo electrónico'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="auth-identifier"
                  type={mode === 'login' ? 'text' : 'email'}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'login' ? 'nombre@consultorio.uy' : 'consultorio@odontologia.uy'}
                  className={authInputClass}
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Contraseña
                  </label>
                  {cloudAuthReady && mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg(null);
                        setInfoMsg(null);
                      }}
                      className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'signup' ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? 'Ingresá tu contraseña' : 'Mínimo 6 caracteres'}
                    className={`${authInputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
              className="min-h-[44px] text-sm"
            >
              {loading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Ingresando...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? 'Iniciar sesión'
                      : mode === 'signup'
                      ? 'Activar prueba gratis de 7 días'
                      : 'Enviar enlace de recuperación'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {mode === 'login' && (
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <span>
                Prueba rápida:{' '}
                <strong className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  drtest
                </strong>{' '}
                /{' '}
                <strong className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  test
                </strong>
              </span>
              <button
                type="button"
                onClick={handleFillTestUser}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors shrink-0 cursor-pointer"
              >
                Completar
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === 'login' ? 'signup' : 'login'));
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors cursor-pointer"
            >
              {mode === 'login' ? (
                <>
                  ¿Todavía no tenés cuenta?{' '}
                  <span className="font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                    Registrate gratis 7 días
                  </span>
                </>
              ) : (
                <>
                  ¿Ya tenés una cuenta?{' '}
                  <span className="font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                    Iniciar sesión
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center lg:text-right text-[11px] text-slate-400 dark:text-slate-500">
          Acceso cifrado · Uso exclusivo del profesional
        </div>
      </main>
    </div>
  );
};
