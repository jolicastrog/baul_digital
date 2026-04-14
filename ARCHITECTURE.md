# 📦 Baúl Digital - Arquitectura y Documentación Técnica

## 1️⃣ Visión General

**Baúl Digital** es una Progressive Web Application (PWA) diseñada para que usuarios colombianos organicen, protejan y gestionen documentos críticos con alertas automáticas de vencimiento.

### Objetivos Clave
- ✅ Privacidad garantizada (Ley 1581 - HABEAS DATA)
- ✅ Acceso offline mediante PWA
- ✅ Escalabilidad serverless
- ✅ Anti-fraude robusto
- ✅ Monetización con planes tiered

---

## 2️⃣ Stack Tecnológico Completo

### Frontend
```
Next.js 14+ (App Router)
├── React 18
├── TypeScript (strict mode)
├── Tailwind CSS 3.4
├── Radix UI / shadcn/ui
├── Lucide React (iconos)
└── Zustand (state management)
```

### Backend & Infraestructura
```
Supabase (BaaS)
├── PostgreSQL 14+ (RLS habilitado)
├── Auth (Magic Links + OAuth)
├── Storage (Signed URLs)
└── Edge Functions (Node.js)

Integración:
├── Cloudflare R2 (CDN)
├── Wompi / ePayco (pagos)
├── SendGrid (email)
└── FingerprintJS (fraud detection)
```

### Despliegue
```
Vercel (Frontend + Edge Functions)
Supabase Cloud (Base de datos + Almacenamiento)
Cloudflare (CDN + R2)
```

---

## 3️⃣ Estructura de Carpetas

```
baulDigital/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page
│   │   ├── (auth)/                   # Rutas de autenticación
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (protected)/               # Rutas protegidas por auth
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   ├── alerts/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── profile/[id]/page.tsx
│   │   ├── admin/                    # Panel administrativo
│   │   │   ├── page.tsx              # Dashboard admin
│   │   │   ├── users/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   └── fraud/page.tsx
│   │   ├── api/                      # API routes
│   │   │   ├── webhooks/
│   │   │   │   ├── wompi/route.ts
│   │   │   │   └── epayco/route.ts
│   │   │   ├── documents/
│   │   │   │   ├── route.ts          # POST upload, GET list, DELETE
│   │   │   │   └── [id]/route.ts     # GET, PATCH, DELETE individual
│   │   │   ├── auth/
│   │   │   │   ├── register/route.ts
│   │   │   │   └── callback/route.ts
│   │   │   └── storage/
│   │   │       └── signed-url/route.ts
│   │   └── layout.tsx                # Root layout
│   ├── components/                   # Componentes React reutilizables
│   │   ├── FileUpload.tsx            # Componente principal de upload
│   │   ├── DocumentCard.tsx
│   │   ├── CategoryFilter.tsx
│   │   ├── AlertsList.tsx
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── OTPInput.tsx
│   │   ├── Premium/
│   │   │   ├── PricingCard.tsx
│   │   │   ├── AdBanner.tsx          # Ads solo para Plan FREE
│   │   │   └── UpgradeModal.tsx
│   │   ├── Admin/
│   │   │   ├── UserManagement.tsx
│   │   │   ├── FraudDashboard.tsx
│   │   │   └── AnalyticsChart.tsx
│   │   └── Common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── Toast.tsx
│   ├── types/                        # TypeScript interfaces & enums
│   │   ├── index.ts                  # Tipos principales
│   │   └── database.ts               # Tipos generados de Supabase
│   ├── lib/                          # Utilidades & clientes
│   │   ├── supabase.ts               # Cliente Supabase singleton
│   │   └── utils/
│   │       └── cn.ts                 # classname merger
│   ├── services/                     # Lógica de negocio
│   │   ├── documentService.ts        # Operaciones de documentos
│   │   ├── paymentService.ts         # Manejo de pagos
│   │   ├── fraudDetectionService.ts  # Validación anti-fraude
│   │   └── alertService.ts           # Sistema de alertas
│   ├── hooks/                        # React hooks personalizados
│   │   ├── useAuth.ts
│   │   ├── useDocuments.ts
│   │   └── useStorageQuota.ts
│   ├── store/                        # Zustand stores (state management)
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   ├── utils/                        # Funciones utilitarias
│   │   ├── fileValidation.ts         # Validación, compresión, fingerprint
│   │   ├── dateFormatting.ts
│   │   └── encryption.ts
│   └── middleware/                   # Middlewares de Next.js
│       ├── auth.ts                   # Protección de rutas
│       └── rateLimit.ts              # Rate limiting
├── supabase/
│   ├── migrations/
│   │   ├── 001_init_schema.sql       # Tablas, RLS, triggers, funciones PLpgSQL
│   │   ├── 002_storage_buckets.sql   # Buckets de Storage + RLS de storage
│   │   └── 003_document_limit.sql    # Tabla plan_limits + trigger de límite de docs
│   ├── functions/
│   │   └── send-alert-notifications/ # Edge Function para alertas de vencimiento
│   └── seed.sql                      # Datos de prueba
├── public/
│   ├── manifest.json                 # Manifiesto PWA
│   ├── service-worker.js             # Service Worker para offline
│   └── icons/                        # Iconos PWA
├── tests/                            # Suite de pruebas
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example                      # Variables de entorno
├── package.json
├── tsconfig.json
├── next.config.js                    # Config con PWA support
├── tailwind.config.js                # Customización Tailwind
└── README.md
```

---

## 4️⃣ Flujos Principales

### A. Registro (Anti-Fraude)
```
Usuario llena formulario
         ↓
Valida cédula (formato)
         ↓
Verifica no exista en BD (UNIQUE constraint)
         ↓
Genera fingerprint del navegador
         ↓
Verifica IP (max 3 registros/hora)
         ↓
Verifica fingerprint (max 2 registros/hora)
         ↓
Si fraud → BLOQUEA y registra en fraud_detection
         ↓
Si OK → Crea profile + auth.users
         ↓
Envía email de confirmación (SendGrid)
```

### B. Carga de Documento
```
Usuario selecciona archivo
         ↓
Valida: tipo, tamaño (2MB max)
         ↓
Comprime si es imagen > 300KB
         ↓
Verifica cuota de almacenamiento (check_storage_quota RPC)
         ↓
Sube a Supabase Storage
  bucket: documents / path: {user_id}/{categoria}/{uuid}.ext
         ↓
INSERT en tabla documents
  → Trigger trg_check_document_limit:
      si plan = free y docs activos >= 10 → ERROR P0001
         ↓
Trigger trg_create_alert_on_document_insert:
  si expiry_date → INSERT en alerts (automático)
         ↓
Actualiza storage_used_bytes (update_storage_used RPC)
         ↓
Genera Signed URL (15 min validez)
         ↓
Muestra confirmación al usuario
```

### C. Pago (Wompi)
```
Usuario elige plan upgr
         ↓
Redirige a página de pago Wompi
         ↓
Paga y Wompi envía webhook
         ↓
API route /webhooks/wompi/ recibe evento
         ↓
Valida firma con HMAC-SHA256
         ↓
Busca usuario por email
         ↓
Si aprobado: actualiza plan_type y storage_quota
         ↓
Crea/actualiza registro en subscriptions
         ↓
Registra en audit_logs
         ↓
Usuario recibe email de confirmación
```

### D. Alertas de Vencimiento (Cron)
```
Cada día a las 09:00 AM (via Supabase Cron)
         ↓
Edge Function query alertas no enviadas
         ↓
Para cada alerta:
   - Calcula días para vencimiento
   - Si <= alert_days_before
      - Envía email (SendGrid)
      - Envía notificación push
      - Marca alert_sent = true
         ↓
Registra ejecución del cron
```

---

## 5️⃣ Seguridad (RLS)

### Principios
- **Usuarios solo ven sus datos**: RLS en todas las tablas
- **Cédula única**: UNIQUE constraint previene duplicados
- **Archivos privados**: El admin NUNCA ve archivos físicos (solo metadatos)
- **Signed URLs**: Acceso temporal a storage (15 min)

### Políticas RLS
```sql
-- PROFILES
- SELECT: auth.uid() = id (usuario ve su perfil)
- SELECT: plan_type = 'enterprise' (admin lee perfiles)

-- DOCUMENTS
- SELECT: auth.uid() = user_id
- INSERT/UPDATE/DELETE: auth.uid() = user_id

-- ALERTS
- SELECT: auth.uid() = user_id
- UPDATE: auth.uid() = user_id

-- FRAUD_DETECTION (admin only)
- SELECT: plan_type = 'enterprise'
```

---

## 6️⃣ Planes y Cuotas

| Plan | Documentos | Storage | Max Archivo | Precio | Características |
|------|-----------|---------|-------------|--------|-----------------|
| **Free** | 10 | 20MB | 2MB | $0 | • 5 categorías • Alertas básicas • Anuncios |
| **Premium** | 500 | 500MB | 10MB | $19.900/mes | • Descargas batch • Sin ads |
| **Enterprise** | Ilimitado | 5GB | 50MB | $79.900/mes | • Todo Premium • API + Admin Panel • Soporte 24/7 |

> Los límites se gestionan en la tabla `plan_limits` (BD). Archivar un documento libera un slot del límite de documentos activos.

---

## 7️⃣ Componentes Clave

### FileUpload.tsx
```typescript
// Props
- userId: string                    // ID del usuario autenticado
- categoryId?: string               // Categoría destino
- onSuccess?: (doc) => void         // Callback de éxito
- onError?: (error: string) => void // Callback de error

// Características
✓ Drag & drop
✓ Compresión en cliente (browser-image-compression)
✓ Validación de archivo
✓ Verificación de cuota
✓ Barra de progreso
✓ Manejo de errores
```

### Otras Componentes Críticos
- **CategoryFilter.tsx**: Pills para filtrar documentos
- **AdBanner.tsx**: Publicidad contextual (solo Plan Free)
- **PricingCard.tsx**: Tarjeta de planes
- **FraudDashboard.tsx**: Panel de detección de fraude

---

## 8️⃣ Guías de UI/UX

### Filosofía de Diseño
- **Mobile-First**: Responsive desde 320px
- **Grandes botones**: Min 44px (accesibilidad)
- **Colores corporativos**:
  - **Azul Confianza**: `#1e40af` (primary)
  - **Verde Esmeralda**: `#10b981` (accent)
  - **Gris Slate**: `#f8fafc` a `#1e293b` (neutrals)

### Paleta Tailwind
```javascript
// tailwind.config.js
colors: {
  'primary-blue': '#1e40af',
  'primary-blue-dark': '#1e3a8a',
  'emerald-accent': '#10b981',
  'emerald-dark': '#059669',
}
```

### Patrones de UI

#### 1. Sistema de Pills (Categorías)
```tsx
<div className="flex flex-wrap gap-2">
  {categories.map(cat => (
    <button
      key={cat.id}
      onClick={() => filterByCategory(cat.id)}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-medium transition',
        active === cat.id
          ? 'bg-primary-blue text-white'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      )}
      style={{ backgroundColor: active === cat.id ? cat.color_code : undefined }}
    >
      {cat.name}
    </button>
  ))}
</div>
```

#### 2. Card de Documento
```tsx
<div className="rounded-xl border border-slate-200 hover:shadow-lg p-4 transition">
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <h3 className="font-semibold text-slate-900">{doc.file_name}</h3>
      <p className="text-sm text-slate-500">{formatBytes(doc.file_size)}</p>
      {doc.expiry_date && (
        <p className={cn(
          'text-xs font-medium mt-2',
          daysUntilExpiry < 30 ? 'text-red-600' : 'text-slate-600'
        )}>
          Vence en {daysUntilExpiry} días
        </p>
      )}
    </div>
    <Menu items={actions} />
  </div>
</div>
```

#### 3. Modal de Alerta
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-md rounded-2xl">
    <AlertCircle className="h-8 w-8 text-yellow-500" />
    <DialogTitle>Documento próximo a vencer</DialogTitle>
    <DialogDescription>
      Tu {document.file_name} vence en 5 días
    </DialogDescription>
    <DialogFooter>
      <Button variant="outline">Descartar</Button>
      <Button onClick={handleRenew}>Renovar ahora</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Estados Visuales

#### Loading
```tsx
<div className="flex items-center space-x-2">
  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-blue border-t-transparent" />
  <span className="text-sm text-slate-600">Cargando...</span>
</div>
```

#### Error
```tsx
<div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start space-x-3">
  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
  <div>
    <p className="font-medium text-red-900">Error</p>
    <p className="text-sm text-red-700">{error}</p>
  </div>
</div>
```

#### Success
```tsx
<div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start space-x-3">
  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
  <div>
    <p className="font-medium text-green-900">¡Éxito!</p>
    <p className="text-sm text-green-700">{message}</p>
  </div>
</div>
```

### Layout Principal
```
┌─────────────────────────────────────┐
│            Header                   │
│  Logo | Search | Profile | Settings │
├──────────────┬──────────────────────┤
│              │                      │
│   Sidebar    │     Content Area     │
│              │                      │
│  • Dashboard │   Documentos listar  │
│  • Documents │   Filtros (Pills)    │
│  • Alerts    │   Documento Cards    │
│  • Settings  │                      │
│              │                      │
└──────────────┴──────────────────────┘
```

---

## 9️⃣ Setup & Instalación

### 1. Clonar y Dependencias
```bash
git clone <repo>
cd baulDigital
npm install
```

### 2. Configurar Variables de Entorno
```bash
cp .env.example .env.local
# Editar .env.local con:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - WOMPI_WEBHOOK_SECRET
# - EPAYCO_WEBHOOK_SECRET
# - etc.
```

### 3. Migrar Base de Datos
```bash
npx supabase link --project-ref <tu-project-ref>  # Primera vez
npx supabase db push                               # Aplica migraciones en Supabase Cloud
```

**Migraciones incluidas:**
- `001_init_schema.sql` — Tablas, RLS, triggers y funciones
- `002_storage_buckets.sql` — Buckets `documents` (privado) y `avatars` (público)
- `003_document_limit.sql` — Límites de documentos por plan (`plan_limits`)

### 4. Ejecutar en Desarrollo
```bash
npm run dev
# Accede a http://localhost:3000
```

### 5. Build para Producción
```bash
npm run build
npm start
```

---

## 🔟 Testing

### Unit Tests (Jest)
```bash
npm run test
```

### Integration Tests (Supabase)
```bash
npm run test:integration
```

### E2E Tests (Playwright)
```bash
npm run test:e2e
```

---

## 1️⃣1️⃣ Monitoreo & Logs

### Auditoría
Todos los eventos se registran en `audit_logs`:
- DOCUMENT_UPLOADED
- DOCUMENT_DOWNLOADED
- DOCUMENT_DELETED
- PAYMENT_APPROVED
- PAYMENT_FAILED
- FRAUD_FLAGGED

### Errores
Se reportan automáticamente a:
1. Console (dev)
2. Sentry (producción)
3. audit_logs (BD)

---

## 1️⃣2️⃣ Deployment en Vercel

```bash
# Conectar repositorio a Vercel
# Configurar variables de entorno en Vercel Dashboard
# Deploy automático en push a main

# Comandos útiles
vercel env pull     # Descargar vars de Vercel
vercel deploy       # Deployar manualmente
```

---

## 📚 Referencias Útiles

- [Documentación Supabase](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)
- [Ley 1581 (HABEAS DATA)](https://www.superfinanciera.gov.co)

---

## 1️⃣3️⃣ Notas Técnicas

### UUID
Se usa `gen_random_uuid()` (nativo PostgreSQL 13+) en lugar de `uuid_generate_v4()`.
La extensión `uuid-ossp` no expone sus funciones en el `search_path` por defecto en Supabase Cloud.

### Storage
- Bucket `documents`: privado, máx 50MB por archivo, tipos: PDF, imágenes, Word, Excel
- Bucket `avatars`: público, máx 2MB por archivo, tipos: imágenes
- RLS de storage basado en path: `{user_id}/{categoria}/{archivo}`

### Límite de Documentos
Implementado via trigger `trg_check_document_limit` (`BEFORE INSERT` en `documents`).
Solo cuenta documentos con `is_archived = FALSE`. Archivar libera un slot.
Los límites están en la tabla `plan_limits` y son ajustables sin cambiar código.

---

**Última actualización**: Abril 2026
**Versión**: 1.0.0 (MVP)
