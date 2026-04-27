# Módulo de Baja de Cuenta — Baúl Digital

Documentación completa del flujo de solicitud y cancelación de baja de cuenta de usuario.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Esquema de base de datos](#2-esquema-de-base-de-datos)
3. [Funciones RPC de Supabase](#3-funciones-rpc-de-supabase)
4. [Endpoints de API](#4-endpoints-de-api)
5. [Cron jobs](#5-cron-jobs)
6. [Correos electrónicos](#6-correos-electrónicos)
7. [Interfaces de usuario](#7-interfaces-de-usuario)
8. [Flujos completos paso a paso](#8-flujos-completos-paso-a-paso)
9. [Reglas de negocio](#9-reglas-de-negocio)
10. [Historial de migraciones](#10-historial-de-migraciones)
11. [Variables de entorno requeridas](#11-variables-de-entorno-requeridas)

---

## 1. Visión general

El módulo de baja de cuenta implementa un **período de gracia de 30 días** antes de eliminar permanentemente una cuenta. Durante ese período el usuario (o un administrador) puede revertir la solicitud. Una vez transcurridos los 30 días, un cron job elimina la cuenta y archiva sus datos por 5 años por cumplimiento legal.

### Actores

| Actor | Puede solicitar baja | Puede cancelar baja | Puede ver panel |
|-------|---------------------|---------------------|-----------------|
| Usuario | ✓ | ✓ | Solo la suya |
| Administrador | — | ✓ | Todas |
| Cron job | — | — | Ejecuta eliminaciones |

---

## 2. Esquema de base de datos

### Tabla `account_deletion_requests`

Definida en migración `035_account_deletion.sql`.

```sql
CREATE TABLE account_deletion_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  user_email      TEXT        NOT NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for   TIMESTAMPTZ NOT NULL,          -- requested_at + 30 días
  reason          TEXT,
  cancelled_at    TIMESTAMPTZ,                   -- NULL = activa
  cancelled_by    TEXT,                          -- 'user' | 'admin'
  executed_at     TIMESTAMPTZ,                   -- NULL = no ejecutada
  executed_by     TEXT,                          -- 'cron' | 'admin'
  request_ip      TEXT,
  request_ua      TEXT
);
```

**Constraint clave — índice único parcial** (migración `049_fix_deletion_unique_constraint.sql`):

```sql
-- Solo UNA solicitud ACTIVA por usuario.
-- Permite múltiples registros históricos (cancelados/ejecutados).
CREATE UNIQUE INDEX uq_deletion_user_active
  ON account_deletion_requests (user_id)
  WHERE cancelled_at IS NULL AND executed_at IS NULL;
```

> **Por qué índice parcial y no UNIQUE(user_id) simple:**
> `cancel_account_deletion()` hace UPDATE (marca `cancelled_at`), no DELETE.
> El registro histórico permanece en la tabla. Un UNIQUE sin condición impedía
> nuevas solicitudes después de cancelar una anterior (error 23505).

**Índice de rendimiento:**

```sql
CREATE INDEX idx_adr_scheduled_for
  ON account_deletion_requests (scheduled_for)
  WHERE cancelled_at IS NULL AND executed_at IS NULL;
```

### Columna `deletion_requested_at` en `profiles`

Agregada en migración `035_account_deletion.sql`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
```

Se usa para mostrar banners de alerta en el dashboard y en mis-archivos. Se pone a `NOW()` al solicitar la baja y a `NULL` al cancelarla o ejecutarla.

### Tabla `email_logs`

Definida en migración `036_deleted_users_archive.sql`. Registra todos los correos enviados por el módulo.

```sql
CREATE TABLE email_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                              -- NULL si el usuario ya fue eliminado
  recipient     TEXT        NOT NULL,
  template      TEXT        NOT NULL,
  subject       TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error_message TEXT,
  metadata      JSONB
);
```

> **Nota:** La columna de timestamp es `sent_at`, no `created_at`.

### Tabla `deleted_users_archive`

Definida en migración `036_deleted_users_archive.sql`. Archiva datos del usuario antes de eliminarlo, por cumplimiento legal (retención 5 años).

---

## 3. Funciones RPC de Supabase

Todas ejecutan con `SECURITY DEFINER` y solo son accesibles por `service_role`.

### `request_account_deletion(p_user_id, p_reason, p_ip, p_ua)`

**Migración:** `035_account_deletion.sql` / corregida en `040_fix_audit_logs_ip_cast.sql`

**Lógica:**
1. Verifica que el usuario exista en `profiles` y esté activo.
2. Verifica que NO exista solicitud activa (`cancelled_at IS NULL AND executed_at IS NULL`).
3. Calcula `scheduled_for = NOW() + INTERVAL '30 days'`.
4. Inserta en `account_deletion_requests`.
5. Actualiza `profiles.deletion_requested_at = NOW()`.
6. Inserta en `audit_logs` con acción `ACCOUNT_DELETION_REQUESTED`.
7. Retorna `{ success, scheduled_for, days_remaining }`.

**Retorno de error:** `{ success: false, error: 'deletion_already_requested' }` si ya existe solicitud activa.

### `cancel_account_deletion(p_user_id, p_ip, p_ua)`

**Migración:** `035_account_deletion.sql` / corregida en `040_fix_audit_logs_ip_cast.sql`

**Lógica:**
1. Verifica que exista solicitud activa para el usuario.
2. `UPDATE account_deletion_requests SET cancelled_at = NOW(), cancelled_by = 'user'`.
3. `UPDATE profiles SET deletion_requested_at = NULL`.
4. Inserta en `audit_logs` con acción `ACCOUNT_DELETION_CANCELLED`.
5. Retorna `{ success: true }`.

**Retorno de error:** `{ success: false, error: 'no_pending_deletion' }` si no hay solicitud activa.

> **Importante:** Esta función hace UPDATE, no DELETE. El registro histórico permanece.

### `admin_cancel_user_deletion(p_request_id, p_admin_note)`

**Migración:** `036_deleted_users_archive.sql`

**Diferencia con `cancel_account_deletion`:** Recibe el `id` de la solicitud (no el `user_id`) y registra `cancelled_by = 'admin'`.

**Lógica:**
1. Busca la solicitud activa por `id = p_request_id`.
2. `UPDATE` con `cancelled_at = NOW(), cancelled_by = 'admin'`.
3. `UPDATE profiles SET deletion_requested_at = NULL`.
4. Inserta en `audit_logs` con acción `ACCOUNT_DELETION_CANCELLED_BY_ADMIN` y el `admin_note`.
5. Retorna `{ success: true, user_id }`.

### `execute_account_deletion(p_user_id, p_executed_by)`

**Migración:** `037_fix_deletion_trigger.sql`

**Lógica:**
1. Busca solicitud activa para el usuario.
2. `UPDATE account_deletion_requests SET executed_at = NOW(), executed_by = p_executed_by`.
3. `UPDATE profiles SET deletion_requested_at = NULL`.
4. Inserta en `audit_logs`.
5. Retorna `{ success: true }`.

> La eliminación real del usuario (`auth.users`) la hace el cron job en el código TypeScript después de llamar este RPC.

### `admin_get_pending_deletions()`

**Migración:** `036_deleted_users_archive.sql`

Retorna todas las solicitudes activas (`cancelled_at IS NULL AND executed_at IS NULL`) con `days_remaining` calculado.

### `get_deletion_reminder_candidates()`

**Migración:** `039_deletion_reminder_function.sql`

Retorna usuarios cuya eliminación está entre 6 y 8 días. Ventana diseñada para evitar enviar el recordatorio más de una vez.

---

## 4. Endpoints de API

### `POST /api/account/request-deletion`

**Archivo:** `src/app/api/account/request-deletion/route.ts`

**Auth:** Usuario autenticado (cookie de sesión).

**Flujo:**
1. Verifica sesión con `supabase.auth.getUser()`.
2. Llama RPC `request_account_deletion`.
3. Obtiene nombre completo de `profiles`.
4. **Envía email `deletion_warning`** (`await sendEmail()`).
5. Retorna `{ success, scheduled_for, days_remaining }`.

**Errores:**
- `401` — No autenticado.
- `409` — Ya existe solicitud activa (`deletion_already_requested`).
- `500` — Error RPC.

### `POST /api/account/cancel-deletion`

**Archivo:** `src/app/api/account/cancel-deletion/route.ts`

**Auth:** Usuario autenticado.

**Flujo:**
1. Verifica sesión.
2. Llama RPC `cancel_account_deletion`.
3. **Envía email `deletion_cancelled`** (`await sendEmail()`).
4. Retorna `{ success: true }`.

**Errores:**
- `401` — No autenticado.
- `404` — No hay solicitud activa (`no_pending_deletion`).

### `DELETE /api/admin/deletions`

**Archivo:** `src/app/api/admin/deletions/route.ts`

**Auth:** Admin (`verifyAdmin()` — verifica `profiles.is_admin = TRUE`).

**Body:** `{ request_id: UUID, admin_note?: string }`

**Flujo:**
1. Verifica que sea admin.
2. Llama RPC `admin_cancel_user_deletion` con el `request_id`.
3. Obtiene email del usuario de `profiles`.
4. **Envía email `deletion_cancelled`** (`await sendEmail()`).
5. Retorna `{ success: true, user_id }`.

**Errores:**
- `403` — No es admin.
- `400` — Falta `request_id`.
- `404` — Solicitud no encontrada o ya procesada.

### `GET /api/admin/deletions`

**Archivo:** `src/app/api/admin/deletions/route.ts`

**Auth:** Admin.

**Query params:** `?tab=pending` (default) | `?tab=deleted&search=...&limit=20&offset=0`

- `tab=pending` → llama `admin_get_pending_deletions()`
- `tab=deleted` → llama `admin_get_deleted_users(p_search, p_limit, p_offset)`

---

## 5. Cron jobs

Configurados en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/expire-subscriptions", "schedule": "0 1 * * *" },
    { "path": "/api/cron/execute-deletions",    "schedule": "0 3 * * *" },
    { "path": "/api/cron/send-reminders",       "schedule": "0 4 * * *" },
    { "path": "/api/cron/purge-archives",       "schedule": "0 2 1 1 *" }
  ]
}
```

### `/api/cron/execute-deletions` — 3:00 AM UTC diario

**Archivo:** `src/app/api/cron/execute-deletions/route.ts`

**Auth:** Header `Authorization: Bearer CRON_SECRET`.

**Flujo por cada usuario vencido:**
1. Llama RPC `execute_account_deletion(user_id, 'cron')`.
2. Llama `supabaseAdmin.auth.admin.deleteUser(user_id)` — elimina de `auth.users`.
3. **Envía email `deletion_confirmed`** (`await sendEmail()`).

### `/api/cron/send-reminders` — 4:00 AM UTC diario

**Archivo:** `src/app/api/cron/send-reminders/route.ts`

**Auth:** Header `Authorization: Bearer CRON_SECRET`.

**Flujo:**
1. Llama `get_deletion_reminder_candidates()` — usuarios con 6-8 días restantes.
2. **Envía email `deletion_reminder`** a cada candidato.

---

## 6. Correos electrónicos

**Proveedor:** Resend (`resend.com`)
**From:** `Baúl Digital <noreply@mibauldigital.com>`
**Archivo core:** `src/lib/email/sendEmail.ts`
**Templates:** `src/lib/email/templates.ts`

### Templates disponibles

| Template | Asunto | Cuándo se envía |
|----------|--------|-----------------|
| `deletion_warning` | "Solicitud de cierre de cuenta recibida — Baúl Digital" | Al solicitar la baja |
| `deletion_cancelled` | "Tu solicitud de cierre de cuenta ha sido cancelada — Baúl Digital" | Al cancelar (usuario o admin) |
| `deletion_reminder` | *(recordatorio)* | Cron: 6-8 días antes de la eliminación |
| `deletion_confirmed` | *(confirmación)* | Cron: al ejecutar la eliminación |

### Función `sendEmail`

```typescript
// src/lib/email/sendEmail.ts
await sendEmail({
  to:       'email@dominio.com',
  subject:  'Asunto',
  html:     templateHtml({ ... }),
  template: 'deletion_warning',  // para email_logs
  userId:   user.id,             // null si el usuario ya fue eliminado
  metadata: { ... },             // datos adicionales para auditoría
});
```

**Todos los envíos usan `await`** — nunca `void sendEmail()`. En Vercel serverless, las Promises no-awaited pueden ser terminadas por el runtime antes de completarse.

**Registro en BD:** Cada envío (exitoso o fallido) queda en `email_logs` con:
- `status`: `'sent'` | `'failed'`
- `error_message`: texto del error si falló
- `sent_at`: timestamp del intento

**Consulta de diagnóstico:**
```sql
SELECT id, recipient, template, status, error_message, sent_at
FROM email_logs
ORDER BY sent_at DESC
LIMIT 20;
```

---

## 7. Interfaces de usuario

### Para el usuario

**1. Página de Configuración** — `src/app/dashboard/settings/page.tsx`
- Muestra botón "Solicitar cierre de cuenta" si no hay solicitud activa.
- Muestra banner con fecha programada y botón "Cancelar solicitud" si hay solicitud activa.
- Llama `POST /api/account/request-deletion` y `POST /api/account/cancel-deletion`.

**2. Dashboard (Mis Archivos)** — `src/app/dashboard/page.tsx`
- Muestra banner naranja de alerta cuando `quota.deletion_requested_at` no es null.
- El botón "Cancelar solicitud" llama directamente a `POST /api/account/cancel-deletion` (con spinner de carga). Al cancelar con éxito recarga los datos del dashboard.

### Para el administrador

**Panel de Bajas** — `src/app/admin/deletions/page.tsx`
- Tab **Pendientes**: lista solicitudes activas con email, fecha solicitada, fecha programada y días restantes. Botón "Cancelar baja" con campo de nota opcional.
- Tab **Eliminados**: historial paginado con buscador. Datos de `deleted_users_archive`.
- Llama `DELETE /api/admin/deletions` con `{ request_id, admin_note }`.

---

## 8. Flujos completos paso a paso

### Flujo A: Solicitar baja

```
Usuario → POST /api/account/request-deletion
  → RPC request_account_deletion()
      → INSERT account_deletion_requests (scheduled_for = NOW() + 30d)
      → UPDATE profiles SET deletion_requested_at = NOW()
      → INSERT audit_logs (ACCOUNT_DELETION_REQUESTED)
  → await sendEmail(deletion_warning)
      → INSERT email_logs
  → Response 200: { scheduled_for, days_remaining }
```

### Flujo B: Cancelar baja (desde usuario — Configuración o Mis Archivos)

```
Usuario → POST /api/account/cancel-deletion
  → RPC cancel_account_deletion()
      → UPDATE account_deletion_requests SET cancelled_at = NOW(), cancelled_by = 'user'
      → UPDATE profiles SET deletion_requested_at = NULL
      → INSERT audit_logs (ACCOUNT_DELETION_CANCELLED)
  → await sendEmail(deletion_cancelled)
      → INSERT email_logs
  → Response 200: { success: true }
```

### Flujo C: Cancelar baja (desde admin)

```
Admin → DELETE /api/admin/deletions { request_id, admin_note }
  → verifyAdmin() — verifica profiles.is_admin = TRUE
  → RPC admin_cancel_user_deletion(request_id, admin_note)
      → UPDATE account_deletion_requests SET cancelled_at = NOW(), cancelled_by = 'admin'
      → UPDATE profiles SET deletion_requested_at = NULL
      → INSERT audit_logs (ACCOUNT_DELETION_CANCELLED_BY_ADMIN)
  → GET profiles WHERE id = user_id (para obtener email)
  → await sendEmail(deletion_cancelled)
      → INSERT email_logs
  → Response 200: { success: true, user_id }
```

### Flujo D: Recordatorio automático (cron 4:00 AM UTC)

```
Cron → POST /api/cron/send-reminders [Authorization: Bearer CRON_SECRET]
  → RPC get_deletion_reminder_candidates()
      → Selecciona usuarios con scheduled_for entre hoy+6 y hoy+8 días
  → Por cada candidato:
      → await sendEmail(deletion_reminder)
```

### Flujo E: Ejecución de eliminación (cron 3:00 AM UTC)

```
Cron → POST /api/cron/execute-deletions [Authorization: Bearer CRON_SECRET]
  → Obtiene usuarios vencidos (scheduled_for <= NOW())
  → Por cada usuario:
      → RPC execute_account_deletion(user_id, 'cron')
          → UPDATE account_deletion_requests SET executed_at = NOW()
          → UPDATE profiles SET deletion_requested_at = NULL
          → INSERT audit_logs (ACCOUNT_DELETION_EXECUTED)
      → supabaseAdmin.auth.admin.deleteUser(user_id)
          → Trigger archive_deleted_user() → INSERT deleted_users_archive
      → await sendEmail(deletion_confirmed)
```

---

## 9. Reglas de negocio

1. **Período de gracia:** 30 días desde la solicitud. No configurable en código; está hardcoded en el RPC `request_account_deletion` como `INTERVAL '30 days'`.

2. **Una sola solicitud activa por usuario:** Garantizado por el índice único parcial `uq_deletion_user_active`. Un usuario puede solicitar baja múltiples veces a lo largo del tiempo; los registros históricos (cancelados/ejecutados) no bloquean nuevas solicitudes.

3. **Correo en toda acción:** Se envía email al usuario en cada evento del ciclo de vida: solicitud, cancelación (por usuario o admin), recordatorio, confirmación de eliminación.

4. **Archivo obligatorio:** Antes de eliminar un usuario de `auth.users`, el trigger `archive_deleted_user()` (en `profiles BEFORE DELETE`) guarda un snapshot en `deleted_users_archive` con retención de 5 años.

5. **Idempotencia del cron:** El cron `send-reminders` usa una ventana de 6-8 días para no enviar el recordatorio más de una vez por ciclo.

6. **Cancelación por admin notifica al usuario:** Cuando un admin cancela la baja de un usuario, el usuario recibe el mismo correo `deletion_cancelled` que recibiría si hubiera cancelado él mismo.

7. **App multi-tenant:** La tabla usa `user_id` (FK a `profiles`) pero el constraint es por `user_id` parcial (solo solicitudes activas), permitiendo historial de bajas por usuario.

---

## 10. Historial de migraciones

| Migración | Propósito |
|-----------|-----------|
| `033_audit_logs_retention.sql` | Agrega columna `retain_until` a `audit_logs` |
| `034_cancel_subscription.sql` | RPC `cancel_subscription` (flujo de cancelación de suscripción, usa audit_logs) |
| `035_account_deletion.sql` | Tabla `account_deletion_requests`, columna `profiles.deletion_requested_at`, RPCs `request_account_deletion` y `cancel_account_deletion` |
| `036_deleted_users_archive.sql` | Tabla `deleted_users_archive`, tabla `email_logs`, trigger `archive_deleted_user`, RPCs `admin_get_pending_deletions`, `admin_cancel_user_deletion`, `admin_get_deleted_users` |
| `037_fix_deletion_trigger.sql` | Corrige el trigger para no bloquear `auth.users DELETE`. Reescribe `execute_account_deletion` sin SQL DELETE (lo hace el SDK) |
| `039_deletion_reminder_function.sql` | RPC `get_deletion_reminder_candidates()` con ventana 6-8 días |
| `040_fix_audit_logs_ip_cast.sql` | Corrige cast TEXT → INET en `audit_logs.ip_address` para los RPCs de solicitud y cancelación |
| `049_fix_deletion_unique_constraint.sql` | Reemplaza `UNIQUE (user_id)` absoluto por índice único parcial `uq_deletion_user_active` |

---

## 11. Variables de entorno requeridas

| Variable | Dónde se usa | Descripción |
|----------|-------------|-------------|
| `RESEND_API_KEY` | `sendEmail.ts` | API key de Resend para envío de correos |
| `NEXT_PUBLIC_SUPABASE_URL` | Todos los clientes | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth del usuario | Clave anon para sesiones de usuario |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabaseAdmin` | Clave service_role para operaciones privilegiadas |
| `CRON_SECRET` | Cron jobs | Token Bearer que Vercel envía en los cron jobs |

> El dominio `mibauldigital.com` debe estar **verificado** en el panel de Resend (`resend.com/domains`) para que los correos salgan desde `noreply@mibauldigital.com`.
