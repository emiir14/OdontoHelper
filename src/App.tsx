/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { isTestAuthActive } from './core/auth/testAuth';
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  LOGIN_ROUTE,
  PublicMarketingRoute,
  SIGNUP_ROUTE,
  parseAppLocation,
  sanitizeInternalNextPath,
} from './core/routing/appRoutes';
import {
  applyPrivateNoIndexMetadata,
  applyPublicSeoMetadata,
} from './core/seo/seoManager';
import type {
  PaidSubscriptionPlanTier,
  SubscriptionBillingCycle,
} from './core/types';

// Code-split strictly by public vs authenticated surface so landing visitors NEVER download clinical/AI bundles.
const LandingPage = lazy(() =>
  import('./components/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const SupabaseAuthView = lazy(() =>
  import('./components/SupabaseAuthView').then((m) => ({ default: m.SupabaseAuthView }))
);
const AuthenticatedApp = lazy(() =>
  import('./components/AuthenticatedApp').then((m) => ({ default: m.AuthenticatedApp }))
);

const ShellLoadingFallback: React.FC = () => (
  <div className="min-h-dvh flex items-center justify-center bg-[#F8F9F5] dark:bg-slate-950 px-4">
    <div className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
      <span>Cargando OdontoHelper...</span>
    </div>
  </div>
);

function hasEnvSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function getMarketingPathForRoute(route: PublicMarketingRoute): string {
  return route === 'landing' ? '/' : `/${route}`;
}

export default function App() {
  const [urlKey, setUrlKey] = useState(() =>
    typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/'
  );
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(() => isTestAuthActive());
  const [checkingSupabaseSession, setCheckingSupabaseSession] = useState<boolean>(() =>
    !isTestAuthActive() && hasEnvSupabaseConfig()
  );

  // Check Supabase session dynamically ONLY when Supabase env vars are configured
  useEffect(() => {
    if (isTestAuthActive()) {
      setHasActiveSession(true);
      setCheckingSupabaseSession(false);
      return;
    }

    if (!hasEnvSupabaseConfig()) {
      setHasActiveSession(false);
      setCheckingSupabaseSession(false);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;

    import('./adapters/supabase/supabaseClient')
      .then(async ({ getSupabaseClient }) => {
        const supabase = getSupabaseClient();
        if (!supabase || cancelled) {
          if (!cancelled) setCheckingSupabaseSession(false);
          return;
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) {
          setHasActiveSession(Boolean(session));
          setCheckingSupabaseSession(false);
        }
        const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
          setHasActiveSession(Boolean(nextSession) || isTestAuthActive());
        });
        unsub = () => sub.data.subscription.unsubscribe();
      })
      .catch(() => {
        if (!cancelled) setCheckingSupabaseSession(false);
      });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const syncUrlKey = () => {
      setUrlKey(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener('popstate', syncUrlKey);
    return () => window.removeEventListener('popstate', syncUrlKey);
  }, []);

  const parsed = parseAppLocation(
    typeof window !== 'undefined' ? window.location.pathname : '/',
    typeof window !== 'undefined' ? window.location.search : ''
  );

  // Ensure SEO metadata matches the active public marketing route vs private auth routes
  useEffect(() => {
    if (parsed.publicRoute) {
      applyPublicSeoMetadata(parsed.publicRoute);
    } else if (!hasActiveSession && parsed.isLoginRoute) {
      applyPrivateNoIndexMetadata(
        parsed.isSignupRoute
          ? 'Prueba gratis 7 días · OdontoHelper Uruguay'
          : 'Iniciar sesión · OdontoHelper'
      );
    }
  }, [hasActiveSession, parsed.publicRoute, parsed.isLoginRoute, parsed.isSignupRoute, urlKey]);

  const navigateToUrl = useCallback((targetUrl: string, replace = false) => {
    if (typeof window === 'undefined') return;
    if (replace) {
      window.history.replaceState(null, '', targetUrl);
    } else {
      window.history.pushState(null, '', targetUrl);
    }
    setUrlKey(`${window.location.pathname}${window.location.search}`);
  }, []);

  const handleNavigateMarketing = useCallback(
    (route: PublicMarketingRoute) => {
      navigateToUrl(getMarketingPathForRoute(route));
    },
    [navigateToUrl]
  );

  const handleNavigateAuth = useCallback(
    (
      mode: 'login' | 'signup',
      plan?: PaidSubscriptionPlanTier,
      cycle?: SubscriptionBillingCycle
    ) => {
      if (mode === 'login') {
        navigateToUrl(LOGIN_ROUTE);
        return;
      }
      const params = new URLSearchParams();
      if (plan) params.set('plan', plan);
      if (cycle) params.set('ciclo', cycle);
      const q = params.toString();
      navigateToUrl(q ? `${SIGNUP_ROUTE}?${q}` : SIGNUP_ROUTE);
    },
    [navigateToUrl]
  );

  const handleAuthenticated = useCallback(() => {
    const currentParsed = parseAppLocation(window.location.pathname, window.location.search);
    const destination =
      sanitizeInternalNextPath(currentParsed.nextPath) || DEFAULT_AUTHENTICATED_ROUTE;
    if (
      window.location.pathname === '/' ||
      window.location.pathname === LOGIN_ROUTE ||
      window.location.pathname === SIGNUP_ROUTE
    ) {
      window.history.replaceState(null, '', destination);
      setUrlKey(destination);
    }
    setHasActiveSession(true);
  }, []);

  const handleSignedOut = useCallback(() => {
    setHasActiveSession(false);
    navigateToUrl('/', true);
  }, [navigateToUrl]);

  // Public Commercial Landing & Marketing Subpages (/, /funciones, /dictado-por-voz, /planes, /preguntas-frecuentes)
  // Always accessible even if the browser already holds an active clinical session.
  if (parsed.publicRoute) {
    return (
      <Suspense fallback={<ShellLoadingFallback />}>
        <LandingPage
          activeRoute={parsed.publicRoute}
          isAuthenticated={hasActiveSession}
          onGoToWorkspace={() => navigateToUrl(DEFAULT_AUTHENTICATED_ROUTE)}
          onNavigateMarketing={handleNavigateMarketing}
          onNavigateAuth={handleNavigateAuth}
        />
      </Suspense>
    );
  }

  // If authenticated on any non-public route -> lazy-load and mount the full clinical application
  if (hasActiveSession) {
    return (
      <Suspense fallback={<ShellLoadingFallback />}>
        <AuthenticatedApp onSignedOut={handleSignedOut} />
      </Suspense>
    );
  }

  // Show lightweight spinner only when checking an existing Supabase session on a non-public route
  if (checkingSupabaseSession) {
    return <ShellLoadingFallback />;
  }

  // Auth Views (/login, /registro) + protected routes (/compartir/:token or deep clinical paths when unauthenticated)
  const nextRedirect = parsed.isLoginRoute
    ? parsed.nextPath
    : sanitizeInternalNextPath(`${window.location.pathname}${window.location.search}`);

  if (!parsed.isLoginRoute && nextRedirect) {
    const redirectUrl = `${LOGIN_ROUTE}?next=${encodeURIComponent(nextRedirect)}`;
    if (`${window.location.pathname}${window.location.search}` !== redirectUrl) {
      window.history.replaceState(null, '', redirectUrl);
    }
  }

  return (
    <Suspense fallback={<ShellLoadingFallback />}>
      <SupabaseAuthView
        onAuthenticated={handleAuthenticated}
        initialMode={parsed.isSignupRoute ? 'signup' : 'login'}
        initialPlan={parsed.requestedPlan}
        initialCycle={parsed.requestedCycle}
        onBackToLanding={() => navigateToUrl('/')}
      />
    </Suspense>
  );
}
