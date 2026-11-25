import React from 'react';
import { ArrowLeft, Home, Sparkles } from 'lucide-react';
import { DEFAULT_AUTHENTICATED_ROUTE, LOGIN_ROUTE } from '../core/routing/appRoutes';

interface NotFoundViewProps {
  requestedPath: string;
  isAuthenticated?: boolean;
  onNavigate: (targetUrl: string) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  requestedPath,
  isAuthenticated = false,
  onNavigate,
}) => {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <div className="min-h-dvh bg-[#F7FCFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            className="inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900 dark:text-white"
          >
            <span className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center text-sm font-bold">
              O
            </span>
            <span>OdontoHelper</span>
          </a>

          <a
            href={isAuthenticated ? DEFAULT_AUTHENTICATED_ROUTE : LOGIN_ROUTE}
            onClick={(e) =>
              handleLinkClick(e, isAuthenticated ? DEFAULT_AUTHENTICATED_ROUTE : LOGIN_ROUTE)
            }
            className="text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline"
          >
            {isAuthenticated ? 'Ir al consultorio' : 'Iniciar sesión'}
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center space-y-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-sm">
          <p className="font-mono text-sm font-bold tracking-widest uppercase text-teal-700 dark:text-teal-300">
            Error 404
          </p>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            No encontramos esta página
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            La dirección{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs break-all">
              {requestedPath}
            </code>{' '}
            no existe o cambió de ubicación en OdontoHelper.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, '/')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Volver al inicio</span>
            </a>

            <a
              href={isAuthenticated ? DEFAULT_AUTHENTICATED_ROUTE : '/planes'}
              onClick={(e) =>
                handleLinkClick(e, isAuthenticated ? DEFAULT_AUTHENTICATED_ROUTE : '/planes')
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-500 transition-colors"
            >
              {isAuthenticated ? <ArrowLeft className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-teal-600" />}
              <span>{isAuthenticated ? 'Volver al consultorio' : 'Ver planes y prueba gratis'}</span>
            </a>
          </div>

          <nav
            aria-label="Enlaces útiles"
            className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <a href="/funciones" onClick={(e) => handleLinkClick(e, '/funciones')} className="hover:text-teal-700 dark:hover:text-teal-300">
              Funciones clínicas
            </a>
            <a href="/dictado-por-voz" onClick={(e) => handleLinkClick(e, '/dictado-por-voz')} className="hover:text-teal-700 dark:hover:text-teal-300">
              Dictado por voz
            </a>
            <a href="/preguntas-frecuentes" onClick={(e) => handleLinkClick(e, '/preguntas-frecuentes')} className="hover:text-teal-700 dark:hover:text-teal-300">
              Preguntas frecuentes
            </a>
          </nav>
        </div>
      </main>
    </div>
  );
};
