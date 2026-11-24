import React, { useState } from 'react';
import {
  Apple,
  CalendarDays,
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Unlink,
  UploadCloud,
} from 'lucide-react';
import { isSupabaseConfigured } from '../adapters/supabase/supabaseClient';
import {
  buildCalendarFeedUrls,
  downloadWorkspaceCalendarIcs,
  isValidCalendarFeedToken,
} from '../core/clinic/calendarFeed';
import { isGoogleCalendarIntegrationAvailable } from '../core/calendar/googleCalendarClient';
import { toLocalIsoDate } from '../core/clinic/clinicHelpers';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { GoogleSignInButton } from './ui/GoogleSignInButton';
import { Modal } from './ui/Modal';

interface CalendarSyncModalProps {
  onClose: () => void;
}

export const CalendarSyncModal: React.FC<CalendarSyncModalProps> = ({ onClose }) => {
  const {
    workspace,
    settings,
    appointments,
    googleCalendarConnected,
    googleCalendarUserEmail,
    googleCalendarLoading,
    googleCalendarSyncing,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    refreshGoogleCalendarEvents,
    syncPendingAppointmentsToGoogleCalendar,
    regenerateCalendarFeedToken,
    openConfirm,
    showToast,
  } = useAppStore();

  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'webcal' | 'https' | null>(null);

  const supabaseReady = isSupabaseConfigured();
  const googleAvailable = isGoogleCalendarIntegrationAvailable();
  const feedToken = settings?.calendarFeedToken;
  const origin =
    typeof window !== 'undefined' && window.location.origin.startsWith('http')
      ? window.location.origin
      : 'https://odontohelper.com.uy';

  const feedUrls =
    isValidCalendarFeedToken(feedToken) ? buildCalendarFeedUrls(origin, feedToken) : null;

  const todayIso = toLocalIsoDate(new Date());
  const pendingUpcomingAppointments = appointments.filter(
    (a) =>
      !a.deletedAt &&
      a.status !== 'cancelled' &&
      a.date >= todayIso &&
      !a.googleEventId
  );

  const handleCopyUrl = async (url: string, kind: 'webcal' | 'https') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(kind);
      showToast('Enlace copiado al portapapeles', 'success');
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      showToast('No se pudo copiar automáticamente; seleccionalo y copialo.', 'warning');
    }
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      await connectGoogleCalendar();
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleSyncAllPendingWithConfirm = () => {
    if (pendingUpcomingAppointments.length === 0) {
      showToast('Todos tus turnos futuros ya están sincronizados en Google Calendar.', 'info');
      return;
    }
    openConfirm({
      title: '¿Enviar turnos pendientes a Google Calendar?',
      description: `Se crearán ${pendingUpcomingAppointments.length} ${
        pendingUpcomingAppointments.length === 1 ? 'evento nuevo' : 'eventos nuevos'
      } en el calendario principal de ${
        googleCalendarUserEmail || 'tu cuenta Google'
      } a partir de hoy (${todayIso}).`,
      confirmText: `Sincronizar (${pendingUpcomingAppointments.length})`,
      cancelText: 'Cancelar',
      onConfirm: () => {
        void syncPendingAppointmentsToGoogleCalendar(
          pendingUpcomingAppointments.map((a) => a.id)
        );
      },
    });
  };

  const handleRegenerateTokenWithConfirm = () => {
    openConfirm({
      title: '¿Regenerar enlace privado de Apple Calendar?',
      description:
        'El enlace anterior dejará de funcionar de inmediato en los dispositivos donde lo hayas agregado. Deberás pegar el nuevo enlace en tu iPhone o Mac.',
      confirmText: 'Regenerar enlace',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: () => {
        void regenerateCalendarFeedToken();
      },
    });
  };

  return (
    <Modal
      onClose={onClose}
      size="xl"
      title="Sincronizar Calendarios Externos"
      subtitle="Conectá tu Google Calendar de forma directa o suscribí Apple Calendar (iPhone / Mac) mediante enlace privado."
      footer={
        <Button variant="primary" onClick={onClose}>
          Listo
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Section 1: Google Calendar Direct Sync */}
        <section className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <CalendarDays className="w-4 h-4 text-teal-600" />
                <span>Google Calendar (Sincronización directa)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Cada profesional conecta su propia cuenta de Google para ver sus eventos personales en la agenda y enviar o actualizar turnos con confirmación.
              </p>
            </div>
            {googleCalendarConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 self-start shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Conectado</span>
              </span>
            ) : null}
          </div>

          {!googleAvailable ? (
            <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3">
              La configuración de Google Calendar no está disponible en este entorno.
            </div>
          ) : googleCalendarConnected ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Cuenta conectada en esta sesión</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {googleCalendarUserEmail}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="subtle"
                    size="xs"
                    icon={<RefreshCw className={`w-3.5 h-3.5 ${googleCalendarLoading ? 'animate-spin' : ''}`} />}
                    onClick={() => void refreshGoogleCalendarEvents()}
                    disabled={googleCalendarLoading}
                  >
                    Actualizar eventos
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={<Unlink className="w-3.5 h-3.5" />}
                    onClick={() => void disconnectGoogleCalendar()}
                  >
                    Desconectar
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60">
                <div className="text-xs text-teal-950 dark:text-teal-100">
                  <strong>{pendingUpcomingAppointments.length}</strong>{' '}
                  {pendingUpcomingAppointments.length === 1
                    ? 'turno próximo aún no enviado'
                    : 'turnos próximos aún no enviados'}{' '}
                  a Google Calendar.
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<UploadCloud className="w-3.5 h-3.5" />}
                  onClick={handleSyncAllPendingWithConfirm}
                  disabled={googleCalendarSyncing || pendingUpcomingAppointments.length === 0}
                >
                  {googleCalendarSyncing
                    ? 'Sincronizando...'
                    : `Enviar pendientes (${pendingUpcomingAppointments.length})`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  Solo solicitamos permiso sobre eventos de tu calendario. Podés desconectarte en cualquier momento.
                </span>
              </div>
              <GoogleSignInButton
                onClick={handleConnectGoogle}
                loading={connectingGoogle}
                className="shrink-0"
              />
            </div>
          )}
        </section>

        {/* Section 2: Apple Calendar / Webcal Suscribable Feed */}
        <section className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Apple className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                <span>Apple Calendar · iPhone, iPad y Mac (Suscripción automática)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Suscribite una sola vez con tu enlace privado <span className="font-mono">webcal://</span> y todos los turnos nuevos o modificados en OdontoHelper aparecerán automáticamente en el calendario de Apple (sin contraseñas de aplicación).
              </p>
            </div>
          </div>

          {feedUrls && (
            <div className="space-y-3">
              {!supabaseReady && (
                <div className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3">
                  El enlace en vivo <span className="font-mono">webcal://</span> queda activo automáticamente cuando conectes Supabase y despliegues en Vercel. Mientras trabajás en modo local, podés usar el botón de descarga completa <strong>.ics</strong>.
                </div>
              )}

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 space-y-2">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Enlace privado de suscripción (Apple Calendar / Outlook / Google)
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    readOnly
                    value={feedUrls.webcalUrl}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-200 select-all"
                    aria-label="Enlace privado webcal para Apple Calendar"
                  />
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={copiedKey === 'webcal' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={() => void handleCopyUrl(feedUrls.webcalUrl, 'webcal')}
                  >
                    {copiedKey === 'webcal' ? 'Copiado' : 'Copiar webcal'}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={feedUrls.webcalUrl}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                >
                  <Apple className="w-3.5 h-3.5" />
                  <span>Abrir en Apple Calendar</span>
                </a>

                <a
                  href={feedUrls.googleSubscribeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Suscribir por URL en Google</span>
                </a>

                <Button
                  variant="subtle"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() =>
                    downloadWorkspaceCalendarIcs(appointments, workspace?.name || 'OdontoHelper')
                  }
                >
                  Descargar agenda (.ics)
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCw className="w-3.5 h-3.5" />}
                  onClick={handleRegenerateTokenWithConfirm}
                >
                  Regenerar enlace privado
                </Button>
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <strong>En iPhone / Mac:</strong> tocá <em>&ldquo;Abrir en Apple Calendar&rdquo;</em> o abrí Calendario → <em>Archivo / Calendarios → Añadir calendario por suscripción</em> y pegá el enlace <span className="font-mono">webcal://</span>.
          </div>
        </section>
      </div>
    </Modal>
  );
};
