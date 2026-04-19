# Plan de Implementación: Panel de Administración

## Resumen Ejecutivo

Panel administrativo interno accesible en `/admin/*`, protegido por un flag `is_admin` en la tabla `profiles`. Usa el mismo formulario de login existente — no hay ruta separada de ingreso. La seguridad es de 3 capas: middleware de Next.js, verificación en cada API route, y funciones SECURITY DEFINER en PostgreSQL.

---

## Módulos del Panel Admin

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/admin` | Métricas globales: usuarios, documentos, ingresos |
| Usuarios | `/admin/users` | Ver, buscar, suspender, asignar is_admin |
| Planes | `/admin/plans` | Crear, editar, activar/desactivar planes |
| Tipos de Documento | `/admin/document-types` | Habilitar/deshabilitar, crear nuevos |
| Categorías Template | `/admin/categories` | Gestionar plantilla de categorías por defecto |
| Pagos | `/admin/payments` | Historial de órdenes, reintentos manuales |
| Suscripciones | `/admin/subscriptions` | Ver suscripciones activas, cancelar |
| Auditoría | `/admin/audit` | Logs del sistema (audit_logs) |
| Detección Fraude | `/admin/fraud` | Ver alertas de fraud_detection |

---

## Arquitectura de Seguridad

### Decisión: `is_admin` en `profiles` (NO rol PostgreSQL)

Supabase usa el rol `authenticated` para todos los usuarios — los roles PostgreSQL personalizados no se reflejan en el JWT de Supabase. Por eso se usa un flag de aplicación.

**Capas de protección:**

1. **Next.js Middleware** (`src/middleware/auth.ts`):
   - Detecta rutas `/admin/*`
   - Lee perfil del usuario para verificar `is_admin = TRUE`
   - Redirige a `/dashboard` si no es admin

2. **API Routes** (`/api/admin/*`):
   - Cada route verifica `is_admin` desde el perfil antes de proceder
   - Usa `supabaseAdmin` (service_role) para operaciones privilegiadas

3. **Funciones PostgreSQL** (SECURITY DEFINER):
   - Funciones admin ejecutan con privilegios elevados
   - Solo accesibles vía `service_role` (REVOKE de anon/authenticated)

---

## Modelo de Datos: Cambios Necesarios

### Ya implementado (migración 028)
```sql
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

### Migración 030: Categorías Template
```sql
CREATE TABLE default_categories_template (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Tabla catálogo (sin user_id — igual que plans y document_types)
-- RLS: SELECT público, INSERT/UPDATE/DELETE solo service_role
-- El trigger setup_new_user leerá esta tabla para crear categorías iniciales
```

### Migración 031: Funciones Admin
```sql
-- Stats globales para el dashboard
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER ...

-- Gestión de usuarios
CREATE OR REPLACE FUNCTION admin_get_users(p_search TEXT, p_limit INT, p_offset INT)
RETURNS TABLE(...) LANGUAGE plpgsql SECURITY DEFINER ...

CREATE OR REPLACE FUNCTION admin_toggle_user_status(p_user_id UUID, p_suspended BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER ...
```

---

## Plan de Ejecución por Fases

### Fase 1 — Base de Datos (Migraciones 030 y 031)

**Migración 030:**
- Crear tabla `default_categories_template` con datos seed
- Actualizar función `setup_new_user` para leer desde esta tabla
- RLS: SELECT público, resto solo service_role

**Migración 031:**
- `admin_get_stats()` → totales de usuarios, documentos, ingresos del mes
- `admin_get_users(search, limit, offset)` → lista paginada con plan y estado
- `admin_toggle_user_status(user_id, suspended)` → suspender/reactivar
- `admin_set_admin_flag(user_id, is_admin)` → promover/revocar admin
- REVOKE EXECUTE de anon/authenticated en todas las funciones admin

### Fase 2 — Middleware de Protección

Actualizar `src/middleware/auth.ts`:
```typescript
// Detectar rutas /admin/*
if (pathname.startsWith('/admin')) {
  // Obtener perfil y verificar is_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  
  if (!profile?.is_admin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}
```

### Fase 3 — API Routes `/api/admin/*`

| Archivo | Métodos | Descripción |
|---------|---------|-------------|
| `route.ts` (stats) | GET | Llama `admin_get_stats()` |
| `users/route.ts` | GET | Lista paginada de usuarios |
| `users/[id]/route.ts` | PATCH | Suspender, promover admin |
| `plans/route.ts` | GET, POST | Listar y crear planes |
| `plans/[id]/route.ts` | PATCH, DELETE | Editar y desactivar planes |
| `document-types/route.ts` | GET, POST | Listar y crear tipos |
| `document-types/[code]/route.ts` | PATCH | Habilitar/deshabilitar |
| `categories/route.ts` | GET, POST | Template de categorías |
| `categories/[id]/route.ts` | PATCH, DELETE | Editar template |
| `payments/route.ts` | GET | Historial de órdenes |
| `audit/route.ts` | GET | Logs paginados |
| `fraud/route.ts` | GET | Alertas activas |

**Patrón de verificación en cada route:**
```typescript
// Verificar is_admin en CADA API route de admin
async function verifyAdmin(request: Request) {
  const supabase = createServerClient(...);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  
  return profile?.is_admin ? user : null;
}
```

### Fase 4 — Frontend `/admin/*`

**Layout compartido** (`src/app/admin/layout.tsx`):
- Sidebar con navegación entre módulos
- Header con nombre del admin y botón logout
- Verificación client-side (doble check con middleware)

**Páginas:**

`src/app/admin/page.tsx` — Dashboard
- Cards: Total usuarios, Documentos, Ingresos mes, Nuevos usuarios hoy
- Tabla últimas 10 suscripciones

`src/app/admin/users/page.tsx` — Usuarios
- Buscador por nombre/email/cédula
- Tabla paginada con: nombre, plan, estado, fecha registro
- Acciones: ver detalle, suspender, promover admin

`src/app/admin/plans/page.tsx` — Planes
- Tabla de planes con precio, límites, estado
- Botón crear plan (modal)
- Editar y activar/desactivar inline

`src/app/admin/document-types/page.tsx` — Tipos de Documento
- Lista con toggle is_active
- Botón crear tipo nuevo (modal)

`src/app/admin/categories/page.tsx` — Categorías Template
- Lista arrastrable (sort_order)
- Editar nombre, ícono, color
- Activar/desactivar (no afecta usuarios existentes)

`src/app/admin/payments/page.tsx` — Pagos
- Filtros: estado, fecha, plan
- Tabla con: usuario, plan, monto, estado, fecha

`src/app/admin/audit/page.tsx` — Auditoría
- Filtros: usuario, tabla, acción, fecha
- Tabla paginada de audit_logs

`src/app/admin/fraud/page.tsx` — Fraude
- Alertas activas con severidad
- Botón marcar como revisada

---

## Consideraciones de Seguridad Adicionales

1. **Sin ruta de login separada**: el admin ingresa por `/login` igual que cualquier usuario. Esto evita revelar la existencia del panel.

2. **Logs de acceso admin**: cada acción del panel debe registrarse en `audit_logs` con `actor_id` del admin.

3. **Primer admin**: se crea directamente en la BD con:
   ```sql
   UPDATE profiles SET is_admin = TRUE WHERE email = 'admin@ejemplo.com';
   ```
   No hay UI para crear el primer admin (bootstrap seguro).

4. **Rate limiting**: las rutas `/api/admin/*` deben tener rate limiting más estricto.

5. **Confirmación para acciones destructivas**: suspender usuario, eliminar plan, etc. requieren confirmación explícita en el frontend.

---

## Dependencias entre Módulos

```
Migración 030 (default_categories_template)
  └── Fase 3: /api/admin/categories
        └── Fase 4: /admin/categories/page.tsx

Migración 031 (funciones admin)
  └── Fase 2: middleware is_admin check
        └── Fase 3: todas las /api/admin/* routes
              └── Fase 4: todas las páginas /admin/*
```

**Orden recomendado:** 030 → 031 → Middleware → API Routes → Frontend

---

## Estimado de Archivos a Crear/Modificar

| Tipo | Cantidad |
|------|----------|
| Migraciones SQL nuevas | 2 (030, 031) |
| Archivos modificados | 2 (middleware, setup_new_user trigger) |
| API routes nuevas | ~12 |
| Páginas frontend nuevas | ~9 |
| Componentes UI nuevos | ~5 (tablas, modales, sidebar) |
