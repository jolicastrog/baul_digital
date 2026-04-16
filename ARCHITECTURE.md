# Baúl Digital — Arquitectura y Documentación Técnica

## 1. Visión General

**Baúl Digital** es una PWA para que usuarios colombianos organicen, protejan y gestionen documentos críticos con alertas automáticas de vencimiento.

### Principios de diseño
- Privacidad garantizada (Ley 1581 - HABEAS DATA)
- Toda operación de BD y Storage ocurre en el servidor (Route Handlers), nunca en el cliente
- El cliente solo usa el Supabase anon client para verificar sesión; el service role key nunca llega al navegador
- RLS habilitada en todas las tablas como capa de seguridad adicional

---

## 2. Stack Tecnológico

### Frontend
```
Next.js 14 (App Router)
├── React 18
├── TypeScript (strict mode)
├── Tailwind CSS 3.4
└── Lucide React (iconos)
```

### Backend
```
Supabase Cloud
├── PostgreSQL 15 (RLS en todas las tablas)
├── Auth (email + password, sesión por cookies)
├── Storage (bucket documents — privado)
└── Triggers y funciones PLpgSQL

Next.js Route Handlers (API)
├── Usa @supabase/ssr con cookies()
├── supabaseAdmin (service role) para operaciones de BD
└── getAnonSupabase() solo para auth.getUser()
```

### Despliegue
```
Vercel → Frontend + API Routes
Supabase Cloud → BD + Auth + Storage
```

---

## 3. Estructura de Carpetas (real)

```
baul_digital/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # Landing / redirect a login
│   │   ├── layout.tsx                      # Root layout
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx              # Formulario de login
│   │   │   └── register/page.tsx           # Formulario de registro
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                  # Sidebar + nav (client component)
│   │   │   ├── page.tsx                    # Bóveda principal
│   │   │   ├── settings/page.tsx           # Perfil y seguridad
│   │   │   └── pricing/page.tsx            # Planes y precios
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts          # POST — iniciar sesión
│   │       │   ├── register/route.ts       # POST — registrar usuario
│   │       │   ├── logout/route.ts         # POST — cerrar sesión
│   │       │   └── me/route.ts             # GET — usuario y perfil autenticado
│   │       ├── documents/route.ts          # GET (lista), PATCH (editar), DELETE
│   │       ├── upload/route.ts             # POST — subir documento a Storage
│   │       ├── profile/route.ts            # GET, PATCH (datos), POST (contraseña)
│   │       └── webhooks/
│   │           ├── wompi/route.ts          # Webhook de pagos Wompi
│   │           └── epayco/route.ts         # Webhook de pagos ePayco
│   ├── components/
│   │   └── FileUpload.tsx                  # Drag & drop, progreso, cuota
│   ├── services/
│   │   ├── documentService.ts              # uploadDocument, getDownloadUrl, deleteDocument
│   │   ├── paymentService.ts               # Validación HMAC webhooks
│   │   └── fraudDetectionService.ts        # Validación cédula, IP, fingerprint
│   ├── middleware/
│   │   └── auth.ts                         # updateSession() — protege rutas con cookies
│   ├── middleware.ts                        # Punto de entrada del middleware
│   ├── lib/
│   │   ├── supabase.ts                     # createBrowserClient (solo para auth en cliente)
│   │   └── utils/cn.ts
│   ├── types/
│   │   ├── index.ts                        # Enums y interfaces principales
│   │   └── database.ts                     # Tipos de tablas Supabase
│   └── utils/
│       └── fileValidation.ts               # validateFile, processFile, formatBytes
├── supabase/
│   └── migrations/
│       ├── 001_init_schema.sql             # Tablas, RLS, RPCs, triggers base
│       ├── 002_storage_buckets.sql         # Buckets documents + avatars + RLS storage
│       ├── 003_document_limit.sql          # plan_limits + trigger check_document_limit
│       ├── 004_auth_trigger.sql            # handle_new_user en auth.users
│       ├── 005_default_categories.sql      # create_default_categories()
│       ├── 006_fix_auth_trigger.sql        # handle_new_user con EXCEPTION handler
│       └── 007_update_free_limit.sql       # Free: 10 → 15 documentos
├── .env.local                              # Variables de entorno (no subir a git)
├── .env.example                            # Plantilla de variables
├── package.json
├── tsconfig.json
├── next.config.js
└── tailwind.config.js
```

---

## 4. Flujos Principales

### A. Registro
```
Usuario llena formulario (nombre, email, cédula, tipo, contraseña)
         ↓
POST /api/auth/register
         ↓
supabase.auth.signUp() con options.data = { full_name, cedula_unica, cedula_tipo }
         ↓
Trigger handle_new_user() en auth.users:
   INSERT en profiles (con COALESCE para valores vacíos)
   CALL create_default_categories(user_id)
   → crea 6 categorías: Identidad, Salud, Educación, Financiero, Propiedad, Otros
         ↓
Redirect a /dashboard
```

### B. Login / Sesión
```
POST /api/auth/login
         ↓
createServerClient con cookies() de next/headers
         ↓
supabase.auth.signInWithPassword()
         ↓
Supabase setea cookies de sesión en el response
         ↓
Middleware (src/middleware.ts) lee cookies en cada request
   → llama updateSession() que refresca el token si expira
   → redirige a /login si no hay sesión en rutas protegidas
```

### C. Carga de Documento
```
Usuario selecciona archivo (drag & drop o clic)
         ↓
FileUpload.tsx → processFile() comprime si es imagen > 300KB
         ↓
POST /api/upload (FormData: file, categoryId, expiryDate)
         ↓
getAnonSupabase().auth.getUser() → verifica sesión
         ↓
supabaseAdmin.from('profiles').select() → verifica cuota disponible
         ↓
supabaseAdmin.from('categories').select() → obtiene nombre para el path
         ↓
Normaliza nombre de categoría (quita tildes y caracteres especiales)
   Ej: "Educación" → "educacion"
         ↓
storagePath = {user_id}/{categoria_normalizada}/{uuid}.{ext}
         ↓
supabaseAdmin.storage.upload() → sube a bucket 'documents'
         ↓
supabaseAdmin.from('documents').insert()
   → Trigger trg_check_document_limit verifica límite del plan
   → Si plan free y docs activos >= 15: lanza excepción P0001
         ↓
supabaseAdmin.rpc('update_storage_used') → incrementa storage_used_bytes
         ↓
supabaseAdmin.storage.createSignedUrl() → URL temporal 15 min
         ↓
supabaseAdmin.from('audit_logs').insert() → registra DOCUMENT_UPLOADED
         ↓
Respuesta: { success, document, signedUrl }
```

### D. Sistema de Alertas (en pantalla)
```
Al cargar /dashboard:
   GET /api/documents → retorna lista de documentos con expiry_date
         ↓
Dashboard clasifica documentos por urgencia:
   🔴 expired[]   → expiry_date < hoy
   🟠 urgent[]    → expiry_date <= hoy + 8 días
   🟡 upcoming[]  → expiry_date <= hoy + 30 días
         ↓
Si hay alguna alerta → muestra panel colapsable con:
   - Encabezado con contador total (clic para desplegar/replegar)
   - Lista scrollable (máx 176px) con nombre + fecha por documento
   - Leyenda con totales por categoría
         ↓
Badge en tarjeta "Alertas Activas" del dashboard
```

> **Nota**: Las alertas por email y SMS están planificadas para Fase 2.
> No se requiere ningún servicio externo para el sistema actual.

### E. Edición de Fecha de Caducidad
```
Clic en ícono lápiz junto a un documento
         ↓
Aparece input date inline + botones ✓ / ✗
         ↓
PATCH /api/documents → { documentId, expiry_date }
         ↓
supabaseAdmin verifica user_id === doc.user_id
         ↓
UPDATE documents SET expiry_date = ?
         ↓
fetchDashboardData() refresca la lista y las alertas
```

---

## 5. Patrón de Autenticación en Route Handlers

Todos los Route Handlers siguen este patrón:

```typescript
// 1. Cliente anon — SOLO para verificar sesión (lee cookies)
function getAnonSupabase() {
  const cookieStore = cookies();
  return createServerClient(URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options));
      },
    },
  });
}

// 2. Cliente admin — para TODAS las operaciones de BD y Storage
const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY);

export async function POST(request: Request) {
  // Verificar sesión
  const { data: { user } } = await getAnonSupabase().auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Operar en BD con admin (bypasea RLS)
  const { data } = await supabaseAdmin.from('tabla').select('*').eq('user_id', user.id);
  // ...
}
```

**¿Por qué este patrón?**
El cliente anon respeta las cookies de sesión del servidor y puede verificar `auth.getUser()`. Sin embargo, usar el cliente anon para consultas de BD puede verse afectado por RLS si `auth.uid()` no se propaga correctamente en el contexto de la función. El service role key bypasea RLS completamente, garantizando que las consultas funcionan. La seguridad se mantiene porque verificamos `user_id === user.id` manualmente en cada operación.

---

## 6. Base de Datos

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Extiende `auth.users`. Almacena cédula, plan, cuota, teléfono |
| `documents` | Metadatos de documentos (no el archivo físico) |
| `categories` | Categorías por usuario (6 por defecto) |
| `plan_limits` | Límites de documentos y storage por plan |
| `audit_logs` | Registro de todas las acciones del sistema |
| `subscriptions` | Historial de suscripciones y pagos |

### Funciones PLpgSQL

| Función | Propósito |
|---------|-----------|
| `handle_new_user()` | Trigger en `auth.users` — crea perfil y categorías al registrarse |
| `create_default_categories(user_id)` | Inserta las 6 categorías por defecto |
| `check_document_limit()` | Trigger BEFORE INSERT — bloquea si se supera el límite del plan |
| `update_storage_used(user_id, bytes)` | Incrementa `storage_used_bytes` en el perfil |
| `free_storage(user_id, bytes)` | Decrementa `storage_used_bytes` al eliminar |

### Storage

| Bucket | Tipo | Límite por archivo | Tipos permitidos |
|--------|------|--------------------|------------------|
| `documents` | Privado | 50 MB | PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX |
| `avatars` | Público | 2 MB | JPG, PNG, WEBP |

**Path de archivos**: `{user_id}/{categoria_normalizada}/{uuid}.{ext}`
- La categoría se normaliza: sin tildes, sin espacios, lowercase
- Ejemplo: `abc123/educacion/74383826-...pdf`

---

## 7. Planes y Precios

| Plan | Documentos | Storage | Mensual | Semestral (-15%) | Anual (-25%) |
|------|-----------|---------|---------|-----------------|--------------|
| **Gratuito** | 15 | 20 MB | $0 | $0 | $0 |
| **Premium** | 500 | 500 MB | $9.900 COP | $8.415 COP/mes | $7.425 COP/mes |
| **Empresarial** | Hasta agotar almacenamiento | 5 GB | $49.900 COP | $42.415 COP/mes | $37.425 COP/mes |

Los límites se controlan en la tabla `plan_limits`. Se puede ajustar sin tocar el código:
```sql
UPDATE plan_limits SET max_documents = 20 WHERE plan_type = 'free';
```

---

## 8. Seguridad

### Ley 1581 - HABEAS DATA
- `cedula_unica` con constraint UNIQUE — previene duplicados
- RLS en todas las tablas — usuarios solo ven sus propios datos
- El administrador nunca puede acceder a archivos físicos (solo metadatos)
- Signed URLs con expiración de 15 minutos para acceso a Storage
- Auditoría completa en `audit_logs`

### RLS activa en
- `profiles` — SELECT/UPDATE solo propietario
- `documents` — SELECT/INSERT/UPDATE/DELETE solo propietario
- `categories` — SELECT/INSERT/UPDATE/DELETE solo propietario
- `plan_limits` — SELECT público (no hay datos sensibles)

### Service Role Key
Solo se usa en el servidor (Route Handlers). Nunca se expone al cliente. Bypasea RLS con intención, pero siempre se valida `user_id === user.id` antes de operar.

---

## 9. Páginas del Dashboard

### `/dashboard` — Bóveda principal
- Tarjetas: Almacenamiento (MB usados/total + barra), Documentos (X/15 + barra), Alertas activas
- Panel de alertas colapsable: vencidos 🔴, urgentes 🟠, próximos 🟡
- Búsqueda por nombre de archivo
- Filtros por categoría (pills)
- Lista de documentos con fecha de subida, tamaño, badge de vencimiento
- Edición inline de fecha de caducidad (lápiz → date picker → ✓/✗)
- Botones Abrir (signed URL) y Eliminar por documento

### `/dashboard/settings` — Configuración
- Avatar con inicial, email y plan actual
- Barra de almacenamiento
- Formulario: nombre, email (readonly), tipo cédula, número cédula, teléfono
- Formulario de cambio de contraseña con confirmación
- Enlace a página de planes

### `/dashboard/pricing` — Planes y precios
- Toggle mensual / semestral (-15%) / anual (-25%)
- 3 tarjetas de plan con precio dinámico y ahorro calculado
- Badge "Más popular" en Premium
- Tabla comparativa de características
- FAQ colapsable (5 preguntas)

---

## 10. Migraciones

Ejecutar en orden con `npx supabase db push` o manualmente en el SQL Editor:

| Archivo | Contenido |
|---------|-----------|
| `001_init_schema.sql` | Tablas base, RLS, RPCs (update_storage_used, free_storage, check_storage_quota) |
| `002_storage_buckets.sql` | Buckets documents y avatars, políticas RLS de storage |
| `003_document_limit.sql` | Tabla plan_limits, trigger trg_check_document_limit |
| `004_auth_trigger.sql` | Trigger handle_new_user en auth.users |
| `005_default_categories.sql` | Función create_default_categories, actualiza trigger |
| `006_fix_auth_trigger.sql` | handle_new_user con EXCEPTION WHEN OTHERS y COALESCE para cedula_unica |
| `007_update_free_limit.sql` | Sube límite free de 10 a 15 documentos |

---

## 11. Variables de Entorno

| Variable | Uso | Visible en cliente |
|----------|-----|--------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin — solo servidor | No |
| `NEXT_PUBLIC_APP_ENV` | `production` / `development` | Sí |
| `NEXT_PUBLIC_STORAGE_TYPE` | `supabase` | Sí |

---

## 12. Notas Técnicas

### UUID
Se usa `gen_random_uuid()` (nativo PostgreSQL 13+) en lugar de `uuid_generate_v4()`. La extensión `uuid-ossp` no expone sus funciones en el `search_path` por defecto en Supabase Cloud.

### Nombres de archivo en Storage
Los nombres de categoría se normalizan antes de usarlos en el path:
```typescript
const safeCategoryName = categoryName
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')  // quita tildes
  .replace(/[^a-zA-Z0-9_-]/g, '_') // reemplaza especiales por _
  .toLowerCase();
```

### cookies() en Next.js 14
Se usa de forma síncrona `cookies()` (sin `await`). La versión async es para Next.js 15+.

### Middleware Edge Runtime
El archivo `src/middleware.ts` corre en Edge Runtime. No puede usar `cookies()` de `next/headers`. Solo puede leer `request.cookies` y escribir en `supabaseResponse.cookies`.

---

**Última actualización**: Abril 2026
**Versión**: 1.1.0 (MVP en producción)
**Autor**: José Lizardo — jlizardocastro@gmail.com
