# Guía completa de despliegue y configuración · OdontoHelper

Esta carpeta `/setup/` reúne **todos los archivos y pasos necesarios** para llevar **OdontoHelper** a producción en **Vercel + Supabase**, administrar altas/renovaciones en USD por transferencia bancaria y conectar en el futuro **Cloudflare R2** para el almacenamiento de audios comprimidos del **Plan Extra**.

---

## 1. Mapa rápido de arquitectura (MVP vs Futuro)

| Componente | Qué hace hoy (MVP) | Notas clave |
|---|---|---|
| **Vercel (Frontend + `/api/*`)** | Sirve la Landing comercial SEO (`/`, `/funciones`, `/dictado-por-voz`, `/planes`, `/preguntas-frecuentes`) separada del sistema clínico autenticado, más funciones serverless en `/api/*` (`/api/health` y `/api/agenda-feed.ics` para Apple Calendar `webcal://`). | `vercel.json` ya configura SPA rewrites, `COOP/COEP` para Whisper local, `microphone=(self)` y CSP estricta. |
| **Supabase (Auth + Postgres + Storage)** | Registro/login con prueba gratis de 7 días (`handle_new_auth_user`), historias clínicas, pacientes, agenda, presupuestos, caja, odontogramas, radiografías privadas (`patient-files`), RPC seguro para feed `webcal://` y suscripciones. | **No almacena audios** en el MVP. Todo protegido por Row-Level Security (RLS). |
| **Google Calendar OAuth** | Cada profesional conecta su propia cuenta de Google (`calendar.events`) usando variables `VITE_FIREBASE_*` en Vercel (sin subir `firebase-applet-config.json` a Git) y tokens solo en memoria. | Agregá tu dominio en **Firebase Auth → Authorized domains** y restringí la API Key por **HTTP Referrer + API** en Google Cloud Console. |
| **Navegador del odontólogo** | Grabación 16 kHz PCM en `IndexedDB` + transcripción Whisper local en WebAssembly. | En **Plan Profesional (`base`)** y prueba gratis el audio **no se comprime** ni sale del dispositivo. |
| **Cloudflare R2 (Futuro Plan Extra)** | *Fuera del MVP.* Guardará audios comprimidos en navegador (`Opus 24 kbps` / `AAC` ≈ `10.8 MB/h`) para **planes avanzados únicamente** (`extra` / `mega`), con cuota razonable de **20 GB (~1.800 hs)** por consultorio. | El código ya deja listas las columnas SQL, tipos en `Session` y helpers en `src/core/audio/cloudAudioSync.ts`. |

---

## 2. Variables de entorno exactas

Podés usar `/.env.example` como plantilla.

### A. Variables del MVP (obligatorias en Vercel y `.env.local`)

| Variable | Dónde conseguirla | Uso | ¿Se expone al navegador? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → **Project Settings → API → Project URL** | Conexión a Auth, Postgres y Storage | Sí (`VITE_*` es público, protegido por RLS) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API → `anon` `public` key** | Clave pública anónima de Supabase | Sí (segura con RLS estricto habilitado) |
| `VITE_GITHUB_REPO` | Tu repo en formato `usuario/repo` (ej. `emiir14/LocalTrans`) | Descargas opcionales desktop/APK | Sí |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Firebase Console → **Project Settings → Your apps (Web)** | Google Calendar OAuth por profesional (opcional; nunca commitear `firebase-applet-config.json` a Git) | Sí (restringir por dominio en Google Cloud) |

### B. Variables futuras para Cloudflare R2 (solo cuando implementes Plan Extra)

> **REGLA CRÍTICA DE SEGURIDAD:** Estas variables **NUNCA** deben llevar el prefijo `VITE_`. Van únicamente en **Vercel → Environment Variables** para ser leídas por funciones serverless en `/api/*`.

| Variable (Server-Only) | Origen |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 → Account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 → Manage R2 API Tokens (permiso *Object Read & Write* solo al bucket) |
| `R2_SECRET_ACCESS_KEY` | Secreto generado junto al token de R2 (se muestra una sola vez) |
| `R2_BUCKET_NAME` | Nombre del bucket privado (ej. `odontohelper-audios`) |
| `SUPABASE_URL` | Mismo Project URL de Supabase (para validar el JWT del usuario desde `/api/*`) |
| `SUPABASE_ANON_KEY` | Misma `anon` key de Supabase (para validar sesión y plan en `/api/*`) |

---

## 3. Paso a paso en Supabase

### 3.1. Crear el proyecto
1. Entrá a [supabase.com](https://supabase.com) → **New project**.
2. **Región recomendada para Uruguay:** `South America (São Paulo) — sa-east-1` (menor latencia hacia Montevideo e interior).
3. Guardá la contraseña de Postgres en un gestor seguro.

### 3.2. Ejecutar el esquema SQL completo
1. En el menú izquierdo de Supabase, abrí **SQL Editor → New query**.
2. Copiá el contenido completo de **`setup/supabase-schema.sql`** y hacé clic en **Run** (o `Ctrl/Cmd + Enter`).
3. El script es **idempotente** (podes volver a correrlo en futuras actualizaciones sin perder datos) y crea:
   - Todas las tablas clínicas (`workspaces`, `profiles`, `patients`, `sessions`, `transcript_segments`, `appointments`, `clinical_evolutions`, `odontograms`, `periodontograms`, `treatment_plans`, `financial_transactions`, `lab_orders`, `patient_files`, `patient_shares`, `settings`, etc.).
   - Tablas de monetización (`workspace_subscriptions`, `subscription_transfer_requests`) + columnas futuras de R2 en `sessions` (`audio_cloud_key`, `audio_cloud_bytes`, `audio_cloud_codec`, `audio_cloud_duration_sec`).
   - Trigger automático **`on_auth_user_created`**: al registrarse un usuario nuevo crea su consultorio, profesional titular, ajustes y activa la **prueba gratis de 7 días**.
   - Políticas **RLS** estrictas por consultorio y fichas compartidas de un solo uso.
   - Bucket privado **`patient-files`** en Storage (para radiografías y fotos clínicas, no audios).
   - Publicación **Realtime** para fichas compartidas.

### 3.3. Configurar Authentication (Login, Registro y URLs)
1. Andá a **Authentication → URL Configuration**:
   - **Site URL:** `https://tu-dominio.com.uy` (o temporalmente `https://tu-proyecto.vercel.app`).
   - **Redirect URLs** (agregá todas estas líneas):
     - `https://tu-dominio.com.uy/**`
     - `https://tu-proyecto.vercel.app/**`
     - `https://*-tu-usuario.vercel.app/**` *(para previews de Vercel, si usás)*
     - `http://localhost:3000/**` *(para desarrollo local)*
2. Andá a **Authentication → Providers → Email**:
   - **Opción recomendada en lanzamiento / pruebas:** si aún no configuraste un SMTP propio (Resend / Postmark), tené en cuenta que el SMTP gratuito de Supabase limita a pocos emails/hora. Para evitar fricción en el alta inicial podés desactivar *Confirm email* temporalmente, o conectar SMTP custom en **Project Settings → Auth → SMTP Settings** antes de campañas masivas.

### 3.4. Verificar Storage y Realtime
1. **Storage → Buckets:** confirmá que existe el bucket **`patient-files`** marcado como **Private** (`Public = false`).
2. **Database → Publications (`supabase_realtime`):** confirmá que estén incluidas `patients`, `clinical_evolutions`, `odontograms`, `periodontograms`, `patient_files` y `patient_shares`.

### 3.5. Cómo aprobar transferencias bancarias USD (operación diaria)
Como no hay pasarela de pago automática, el cliente informa su transferencia en USD desde el modal de suscripción (guardando fila en `subscription_transfer_requests` en estado `pending`) y/o te manda el comprobante por WhatsApp.

Para activar o renovar el plan:
1. Abrí **SQL Editor** y usá **`setup/supabase-activar-suscripcion.sql`**.
2. Corré la **Consulta 1** para ver los avisos `pending` con su `transfer_request_id`, código de consultorio y monto en USD.
3. Corré el bloque `do $$ ... end; $$;` de la **Consulta 2** reemplazando `REQ_ID_AQUI`: actualiza `subscription_transfer_requests.status = 'approved'` y extiende `workspace_subscriptions.current_period_end` (+30, +90 o +365 días).

---

## 4. Paso a paso para subir el proyecto a Vercel

### 4.1. Preparar el repositorio
1. Asegurate de tener todo commiteado en tu rama `main` de GitHub / GitLab / Bitbucket.
2. Confirmá que exista `vercel.json` en la raíz del proyecto (ya incluido).

### 4.2. Importar y configurar en Vercel
1. Entrá a [vercel.com](https://vercel.com) → **Add New… → Project** e importá el repositorio.
2. En **Build & Development Settings**:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
   - **Node.js Version:** `20.x` (en Project Settings → General).
3. En **Environment Variables** (antes del primer Deploy):
   - Agregá `VITE_SUPABASE_URL` (Production + Preview + Development)
   - Agregá `VITE_SUPABASE_ANON_KEY` (Production + Preview + Development)
   - Agregá `VITE_GITHUB_REPO` (opcional, ej. `emiir14/LocalTrans`)
4. Hacé clic en **Deploy**.

### 4.3. Qué resuelve automáticamente `vercel.json`
No necesitás configurar rewrites manuales en el panel porque `vercel.json` ya define:
- **Headers COOP/COEP (`same-origin-allow-popups` / `credentialless`):** permite el popup OAuth de Google Calendar sin bloquearlo, manteniendo `credentialless` para el entorno local.
- **`Permissions-Policy: microphone=(self)`:** permite captura de micrófono en HTTPS.
- **`Content-Security-Policy`:** autoriza `*.supabase.co` (HTTPS + WSS), HuggingFace / jsDelivr (descarga local de modelos Whisper en el navegador), Google/Firebase OAuth (`accounts.google.com`, `www.googleapis.com`, `identitytoolkit.googleapis.com`, `*.firebaseapp.com`), y `vercel.live` para previews.
- **Feed iCal y SPA Rewrite:** expone `/api/agenda-feed.ics` → `/api/agenda-feed` (para suscripciones `webcal://` de Apple Calendar) y redirige rutas de la app a `/index.html` **sin interceptar** `/api/*` ni `/assets/*`.

### 4.4. Dominio propio `.com.uy` / `.uy`, Google OAuth y SEO
1. En **Vercel → Project → Settings → Domains**, agregá tu dominio (ej. `odontohelper.com.uy` y `www.odontohelper.com.uy`, eligiendo uno como principal con redirect 308 al otro).
2. Para que el popup de **Google Calendar** funcione en tu dominio final de producción de forma segura:
   - Cargá `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` (y opcionalmente `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`) en **Vercel → Environment Variables** y en `.env.local` (ambos excluidos de Git por `.gitignore`).
   - En **Firebase Console → Authentication → Settings → Authorized domains**, agregá `tu-dominio.com.uy` y `tu-proyecto.vercel.app`.
   - En **Google Cloud Console → APIs & Services → Credentials → tu Browser API Key**, configurá:
     - **Application restrictions → Websites**: permití solo `https://tu-dominio.com.uy/*`, `https://tu-proyecto.vercel.app/*` y `http://localhost:3000/*`.
     - **API restrictions → Restrict key**: habilitá únicamente **Identity Toolkit API**, **Token Service API** y **Google Calendar API** (nunca dejes habilitadas APIs de pago como Gemini sobre la clave pública web).
3. Si tu dominio final difiere de `https://odontohelper.com.uy`, actualizá:
   - `CANONICAL_ORIGIN` en `src/core/seo/seoManager.ts`
   - `public/sitemap.xml` y `public/robots.txt`
   - `Site URL` y `Redirect URLs` en Supabase Auth.
4. Verificá `https://tu-dominio.com.uy/sitemap.xml` y `https://tu-dominio.com.uy/robots.txt`, y enviá el sitemap en **Google Search Console** para indexar rápido en Uruguay.

---

## 5. Conexión futura con Cloudflare R2 (Plan Extra · fuera del MVP)

> **Estado actual:** Desactivado deliberadamente en el MVP.
> **Regla de arquitectura:** **Plan Profesional (`base`) y la prueba de 7 días NUNCA comprimen ni suben audio** (para no agregar carga al navegador ni costos de nube). Solo los planes avanzados (`extra` / `mega`) activarán el flujo siguiente.

### 5.1. Crear y asegurar el bucket en Cloudflare R2
1. En Cloudflare Dashboard → **R2 Object Storage → Create bucket**:
   - Nombre: `odontohelper-audios`
   - Ubicación recomendada: **WNAM / ENAM** o **Automatic** (el tráfico con presigned URLs va directo por red Cloudflare).
   - Dejá **Public Access DESACTIVADO** (nunca público: son audios clínicos).
2. En el bucket → **Settings → CORS Policy**, agregá:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://tu-dominio.com.uy",
         "https://tu-proyecto.vercel.app",
         "http://localhost:3000"
       ],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type", "Content-Length"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. Andá a **R2 → Overview → Manage R2 API Tokens → Create API token**:
   - **Permissions:** *Object Read & Write*
   - **Specify bucket(s):** únicamente `odontohelper-audios`
   - Guardá `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.

### 5.2. Cargar variables y actualizar CSP en Vercel
1. Agregá en **Vercel → Environment Variables** (sin `VITE_`):
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME=odontohelper-audios`
   - `SUPABASE_URL` y `SUPABASE_ANON_KEY`
2. En `vercel.json`, agregá `https://*.r2.cloudflarestorage.com` a las directivas **`connect-src`** y **`media-src`** del header `Content-Security-Policy`.

### 5.3. Pasos de código cuando decidas activarlo
1. **Instalar SDK S3 liviano:** `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
2. **Crear endpoint Vercel `/api/audio-presign.ts`:**
   - Recibe `Authorization: Bearer <supabase_access_token>`, `sessionId`, `mimeType`, `bytes` y `durationSec`.
   - Valida el JWT contra Supabase y consulta `workspace_subscriptions`:
     - Rechaza con `403` si `plan_tier` no es `'extra'` o `'mega'`, o si el plan está vencido (`status = 'expired'`).
     - Suma `coalesce(sum(audio_cloud_bytes), 0)` de `sessions` del consultorio y verifica que no supere `20 * 1024 * 1024 * 1024` (**20 GB** — cláusula de uso razonable ≈ 1.800 hs a 24 kbps).
   - Genera y devuelve una **Presigned PUT URL** (expiración 5 min) bajo clave `workspaces/{workspace_id}/sessions/{session_id}.{webm|m4a}` (y **Presigned GET URL** temporal cuando el odontólogo quiera reproducirlo en otro equipo).
3. **Activar compresión nativa solo para planes avanzados en el cliente:**
   - Usar `shouldCompressAudioForPlan(workspaceSubscription?.planTier)` y `resolvePreferredCompressedAudioSpec()` de `src/core/audio/cloudAudioSync.ts`.
   - Si es `true` (`extra` / `mega`), `RecordingController` adjunta un `MediaRecorder` paralelo sobre el mismo `MediaStream` usando `audio/webm;codecs=opus` (o `audio/mp4` en iOS/Safari) a **`24 kbps`** (`~10.8 MB` por consulta de 1 hora).
   - Si es `false` (`trial` / `base`), **no se instancia `MediaRecorder`**: sigue 100% PCM local sin gasto extra de CPU ni batería.
4. **Implementar `CloudflareR2AudioAdapter`** cumpliendo `ICloudAudioStorageAdapter` en `src/core/audio/cloudAudioSync.ts` y guardar en Supabase los campos ya existentes en `sessions`: `audio_cloud_status = 'synced'`, `audio_cloud_key`, `audio_cloud_bytes`, `audio_cloud_codec` y `audio_cloud_duration_sec`.

---

## 6. Checklist final después de desplegar

- [ ] Entrar a `https://tu-dominio/` en ventana incógnita → carga rápida solo la **Landing comercial**, sin pedir login.
- [ ] Probar `https://tu-dominio/api/health` → responde `200 OK` JSON.
- [ ] Entrar a `/registro?plan=base&ciclo=anual` → crear una cuenta nueva de prueba y verificar en Supabase que se crearon `workspaces`, `profiles`, `settings` y `workspace_subscriptions` (`trial`, +7 días).
- [ ] Probar aviso de vencimiento / modal de transferencia USD → verificar que los montos sean exclusivamente en USD y el **Mega Plan** figure como no disponible.
- [ ] Abrir **Dictado por voz** en HTTPS → aceptar permiso de micrófono, grabar 10 s y comprobar transcripción local.
- [ ] Subir una imagen en la ficha de un paciente → verificar archivo privado en Supabase Storage (`patient-files`).
- [ ] En **Agenda → Sincronizar Apple / Google**, probar el enlace `webcal://` (`/api/agenda-feed.ics?token=...` devuelve `200 OK` `text/calendar`) y la conexión OAuth con Google Calendar.
- [ ] Verificar `/robots.txt` y `/sitemap.xml` públicos y sin errores 404.
