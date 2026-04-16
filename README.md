# Baúl Digital

PWA de gestión segura de documentos personales para usuarios colombianos. Permite subir, organizar y proteger documentos importantes con alertas automáticas de vencimiento.

---

## Características implementadas

| Módulo | Estado |
|--------|--------|
| Autenticación (registro, login, logout) | ✅ Producción |
| Dashboard con documentos y búsqueda | ✅ Producción |
| Carga de archivos a Supabase Storage | ✅ Producción |
| Cuota de almacenamiento por plan | ✅ Producción |
| Categorías automáticas al registrarse | ✅ Producción |
| Edición de fecha de caducidad (inline) | ✅ Producción |
| Eliminación de documentos | ✅ Producción |
| Panel de alertas de vencimiento (en pantalla) | ✅ Producción |
| Página de perfil y configuración | ✅ Producción |
| Página de planes y precios | ✅ Producción |
| Integración de pagos (Wompi/ePayco) | 🔜 Fase 2 |
| Alertas por email | 🔜 Fase 2 |
| Admin dashboard | 🔜 Fase 2 |

---

## Stack tecnológico

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Auth**: `@supabase/ssr` con cookies en Route Handlers y middleware
- **Iconos**: Lucide React

---

## Inicio rápido

### 1. Instalar dependencias
```bash
cd baul_digital
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env.local
```

Editar `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_STORAGE_TYPE=supabase
```

### 3. Aplicar migraciones en Supabase
```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

O ejecutarlas manualmente en el SQL Editor de Supabase en orden:
1. `supabase/migrations/001_init_schema.sql`
2. `supabase/migrations/002_storage_buckets.sql`
3. `supabase/migrations/003_document_limit.sql`
4. `supabase/migrations/004_auth_trigger.sql`
5. `supabase/migrations/005_default_categories.sql`
6. `supabase/migrations/006_fix_auth_trigger.sql`
7. `supabase/migrations/007_update_free_limit.sql`

### 4. Ejecutar en desarrollo
```bash
npm run dev
# http://localhost:3000
```

---

## Estructura de rutas

```
/                          → Landing page
/login                     → Inicio de sesión
/register                  → Registro de usuario
/dashboard                 → Bóveda principal (documentos)
/dashboard/settings        → Perfil y configuración
/dashboard/pricing         → Planes y precios
```

---

## Planes disponibles

| Plan | Documentos | Almacenamiento | Precio |
|------|-----------|----------------|--------|
| Gratuito | 15 | 20 MB | $0 |
| Premium | 500 | 500 MB | $9.900 COP/mes |
| Empresarial | Hasta agotar almacenamiento | 5 GB | $49.900 COP/mes |

Descuentos: **15% semestral** · **25% anual**

---

## Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (solo servidor) |
| `NEXT_PUBLIC_APP_ENV` | `production` o `development` |
| `NEXT_PUBLIC_STORAGE_TYPE` | `supabase` |

---

## Desarrollador

**José Lizardo** — jlizardocastro@gmail.com

*Baúl Digital — Gestión inteligente y segura de documentos para Colombia*
