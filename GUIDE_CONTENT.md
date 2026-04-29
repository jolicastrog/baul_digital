# Guía de Usuario — Documento de Referencia de Contenido

Este archivo centraliza toda la información técnica y de negocio que se usó para construir la página de guía de usuario del dashboard (`src/app/dashboard/guide/page.tsx`). Úsalo como fuente de verdad para agregar, quitar o modificar secciones de la guía.

---

## Ubicación del archivo

```
src/app/dashboard/guide/page.tsx
```

Accesible desde el menú lateral del dashboard bajo el enlace **"Guía de uso"** (icono `BookOpen`), ubicado entre **Planes** y **Configuración**. El enlace también aparece en el panel de onboarding (`src/components/OnboardingPanel.tsx`) como "Ver guía completa".

---

## Estructura técnica de la página

La página exporta `GuidePage` (componente de cliente) y usa:

- **`SECTIONS` array** — cada elemento define una sección colapsable con: `id`, `Icon`, `color`, `borderColor`, `bg`, `iconBg`, `title`, `intro`, `steps[]`, `notes[]`, `limits[]|null`.
- **`GuideSection` component** — renderiza encabezado colapsable + contenido (pasos numerados, notas con badge Premium, tabla de límites).
- **`PLAN_COMPARISON` array** — tabla comparativa de planes al final de la página.
- Estado `openSections` — controla qué secciones están abiertas. Por defecto abre `upload`.
- Botones "Expandir todo / Colapsar todo".
- Banner para usuarios en plan Gratuito con enlace a `/dashboard/pricing`.
- Carga plan del usuario vía `GET /api/auth/me` para mostrar/ocultar el banner.

Íconos usados (importados de `lucide-react`):
`Upload, FolderOpen, Calendar, Eye, Bell, ShieldCheck, XCircle, UserX, CheckCircle2, Zap, ArrowRight, ChevronDown, ChevronUp, BookOpen, CreditCard`

---

## Secciones actuales

### 1. Subir documentos (`upload`) — Azul

**Intro:** Sube tus archivos de forma rápida y segura desde cualquier dispositivo.

**Pasos:**
1. **Abrir el panel de carga** — Clic en el botón "Subir Documento" en la parte superior de la bóveda.
2. **Seleccionar el archivo** — Arrastra al área punteada o haz clic para abrir el explorador.
3. **Elegir categoría (opcional)** — Asigna el documento a una categoría. Puedes hacerlo después.
4. **Asignar fecha de vencimiento (opcional)** — Para documentos con vigencia (SOAT, pasaporte, licencia), agrégala aquí para recibir alertas.

**Notas:**
- (Todos los planes) Formatos: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), JPEG, PNG, WebP.
- (Todos los planes) Las imágenes se comprimen automáticamente sin pérdida visible de calidad.
- (Premium) También puedes subir audio MP3 y video MP4.

**Tabla de límites:**
| Plan        | Almacenamiento | Documentos | Tamaño máx. archivo |
|-------------|----------------|------------|---------------------|
| Gratuito    | 50 MB          | 15 docs    | 5 MB                |
| Premium     | 500 MB         | 200 docs   | 50 MB               |
| Empresarial | 5 GB           | Ilimitados | 100 MB              |

**Respaldo técnico:**
- Validación client-side: `src/utils/fileValidation.ts` → `validateFile()` y `processFile()`.
- Validación server-side: `src/app/api/upload/route.ts` consulta `plans.allow_media_files` y `plans.max_file_size_mb` por plan del usuario.
- Columnas en BD: `plans.max_file_size_mb` y `plans.allow_media_files` (migración `052_plans_media_and_file_limits.sql`).
- Valores en BD: free → 5 MB / FALSE; premium → 50 MB / TRUE; enterprise → 100 MB / TRUE.
- Compresión de imágenes: `src/utils/imageCompression.ts` → `compressImage()`.

---

### 2. Categorías y búsqueda (`categories`) — Esmeralda

**Intro:** Organiza tus documentos en grupos y encuéntralos rápidamente.

**Pasos:**
1. **Asignar categoría al subir** — Seleccionar categoría en el formulario de carga. Se puede dejar vacío y asignar después.
2. **Mover un documento a otra categoría** — Clic en el botón de carpeta con flecha (→📂 ícono `FolderInput`) a la derecha de cada archivo. Se abre un dropdown "Mover a..." con las categorías disponibles. Se puede elegir "Sin categoría" para quitar la clasificación.
3. **Filtrar por categoría** — Botones tipo etiqueta encima de la lista de documentos (uno por categoría + "Todos los Archivos"). Haz clic en uno para filtrar.
4. **Buscar por nombre** — Barra de búsqueda (lupa 🔍) en la parte superior de la bóveda. Compatible con el filtro de categoría simultáneamente.

**Notas:**
- (Gratuito) 6 categorías predefinidas: Identidad, Vehículo, Salud, Educación, Finanzas, Otros.
- (Premium) Hasta 25 categorías personalizadas.
- (Empresarial) Categorías ilimitadas.

**Respaldo técnico:**
- El botón mover usa `FolderInput` (lucide-react), estado `movingDocId`, handler `handleMoveDoc()`.
- `handleMoveDoc` llama `PATCH /api/documents/[id]` con `{ category_id }`.
- El dropdown filtra categorías distintas a la actual y muestra "Sin categoría" si el doc ya tiene una.
- Los filtros de categoría son botones horizontales con scroll, estado `activeCategoryId`.
- La búsqueda usa estado `searchQuery`, filtra `doc.file_name.toLowerCase().includes(...)`.
- Ambos filtros se aplican en conjunto en `filteredDocuments`.

---

### 3. Fechas de vencimiento (`expiry`) — Naranja

**Intro:** Nunca más dejes vencer un documento importante. El sistema te avisa con anticipación.

**Pasos:**
1. **Asignar la fecha** — Al subir o editar un documento, seleccionar la fecha en el campo "Fecha de Caducidad".
2. **Ver el panel de alertas** — Aparece automáticamente en la bóveda cuando hay documentos próximos a vencer.
3. **Editar o quitar la fecha** — Clic en el ícono de lápiz (✏️ `Pencil`) del documento para modificar o eliminar la fecha.

**Notas:**
- (Todos) Rojo: vencido. Naranja: vence en ≤ 8 días. Amarillo: vence en ≤ 30 días.
- (Premium) Nota recordatoria personalizada (ej. "Iniciar trámite de renovación 15 días antes").
- (Premium) Correos automáticos 30, 8 y 1 día antes del vencimiento.

**Respaldo técnico:**
- Edición inline: estado `editingExpiry { id, value, note }`, handler `handleSaveExpiry()`.
- `handleSaveExpiry` llama `PATCH /api/documents` con `{ documentId, expiry_date, expiry_note }`.
- La nota solo se muestra/edita si `quota.plan_type` es `premium` o `enterprise`.
- Clasificación de documentos: `expired` (< now), `urgent` (≤ 8 días), `upcoming` (≤ 30 días).
- Panel de alertas colapsable, estado `alertsExpanded`.

---

### 4. Vista previa y descarga (`preview`) — Púrpura

**Intro:** Consulta o descarga cualquier documento sin complicaciones.

**Pasos:**
1. **Abrir la vista previa** — Clic en el botón "Ver" (ícono de ojo `Eye`) del archivo. El sistema obtiene un enlace seguro y abre el visor.
2. **Qué muestra el visor según el tipo** — PDF: visor con barra completa (zoom, páginas). Imágenes (JPEG, PNG, WebP): pantalla completa. Audio MP3: reproductor de audio integrado. Video MP4: reproductor de video integrado. Word/Excel: se abre en nueva pestaña para descargar y abrir con app de oficina.
3. **Descargar desde el visor** — Botón "Descargar" (ícono `Download`) en la barra superior del visor.
4. **Cerrar el visor** — Clic en la "X" o presionar Escape.

**Notas:**
- (Todos) Los enlaces expiran en 15 minutos por seguridad. Si no carga, cerrar y volver a abrir.
- (Todos) Vista previa integrada: PDF, imágenes, MP3, MP4.
- (Todos) Word y Excel: la opción "Ver" abre una pestaña de descarga.

**Respaldo técnico:**
- Handler `handleOpen(docId, fileName, storedFileType)` en `dashboard/page.tsx`.
- Obtiene URL firmada vía `GET /api/documents/url?id=`.
- `mimeType` = `storedFileType` (de BD `documents.file_type`) o fallback por extensión con `getMimeType()`.
- Previewable (abre modal): `image/*`, `application/pdf`, `audio/*`, `video/*`.
- No previewable (abre nueva pestaña): `application/octet-stream`, Word, Excel, etc.
- Modal con 5 ramas: PDF → `<iframe>`, imagen → `<img>`, video → `<video controls>`, audio → `<audio controls>`, otros → fallback con botón descargar.
- URL firmada: `supabase.storage.from(...).createSignedUrl(..., 900)` (900 segundos = 15 min).

---

### 5. Alertas de vencimiento (`alerts`) — Amarillo

**Intro:** El sistema monitorea tus documentos y te avisa cuando se acerca una fecha crítica.

**Pasos:**
1. **Panel de alertas en bóveda** — Aparece automáticamente en la parte superior cuando hay documentos con fechas próximas o vencidas.
2. **Expandir o contraer** — Clic en el encabezado del panel para ver el detalle completo.
3. **Tomar acción** — Clic en el documento para editarlo, cambiar la fecha o descargarlo.

**Notas:**
- (Todos) Las alertas en pantalla son visibles sin costo adicional.
- (Premium) Correo automático 30, 8 y 1 día antes del vencimiento.
- (Premium) Los correos se pueden activar/desactivar desde el panel de administración.

**Respaldo técnico:**
- Cron `send-expiry-reminders` — corre diariamente a las 2 AM UTC (definido en `src/app/api/cron/send-expiry-reminders/route.ts`).
- Solo envía correos a usuarios con plan `premium` o `enterprise`.
- Usa Resend para envío de emails; plantilla `expiry_warning`.
- El panel de alertas en bóveda es puramente client-side, se calcula al cargar `documents`.

---

### 6. Gestión de suscripción (`subscription`) — Azul cielo

**Intro:** Cómo cancelar tu plan Premium o Empresarial y qué ocurre después.

**Pasos:**
1. **Ir a Configuración** — Menú lateral → "Configuración". Sección "Suscripción": plan actual, fecha de renovación, botón de cancelar.
2. **Cancelar el plan** — Clic en "Cancelar suscripción" y confirmar. El plan permanece activo hasta el final del período pagado, sin cobro adicional ni reembolso.
3. **Downgrade automático** — Al vencer el período, proceso automático (1 AM UTC) degrada la cuenta a Gratuito. Si excede límites de Gratuito, no puede subir nuevos archivos hasta liberar espacio.
4. **Reactivar el plan** — Se puede contratar de nuevo Premium o Empresarial desde "Planes" en el menú.

**Notas:**
- (Info) Solo planes de pago pueden cancelarse.
- (Info) Sin reembolsos parciales por tiempo no utilizado.
- (Info) Los documentos existentes no se eliminan al cancelar; solo hay restricción para subir nuevos si se superan los límites del plan Gratuito.

**Respaldo técnico:**
- Handler en `src/app/dashboard/settings/page.tsx`: `handleCancelSubscription()`.
- Llama `POST /api/account/cancel-subscription`.
- Cron `expire-subscriptions` — corre a las 1 AM UTC, revisa `profiles.subscription_expires_at <= now()` y cambia `plan_type` a `'free'`.
- No hay lógica de pago real integrada aún (campo `subscription_expires_at` en `profiles`).

---

### 7. Dar de baja / Eliminar cuenta (`deletion`) — Rosa

**Intro:** Solicita la eliminación total de tu cuenta con un período de gracia de 30 días.

**Pasos:**
1. **Solicitar la eliminación** — Configuración → "Zona de peligro" → "Eliminar mi cuenta". Se programa la eliminación definitiva 30 días después.
2. **Período de gracia (30 días)** — Se puede cancelar la solicitud desde Configuración o desde el aviso naranja en la bóveda. La cuenta sigue funcionando con normalidad.
3. **Correos de notificación** — (1) Correo inmediato al solicitar, (2) recordatorio 6-8 días antes, (3) confirmación tras ejecución.
4. **Eliminación definitiva** — Pasados los 30 días, documentos y datos de cuenta se eliminan de forma permanente e irreversible.

**Notas:**
- (Legal) Metadatos personales (nombre, email) archivados 5 años — Ley 1581 de 2012 (Habeas Data Colombia). Documentos sí se eliminan.
- (Info) Si hay suscripción de pago activa, también se cancela. Sin reembolsos.
- (Info) Se puede cancelar la solicitud hasta antes de que el cron la ejecute (3 AM UTC diario). Una vez ejecutada, es irreversible.

**Respaldo técnico (ver `ACCOUNT_DELETION_MODULE.md` para detalle completo):**
- Tabla: `account_deletion_requests (id, user_id, scheduled_for, cancelled_at, executed_at)`.
- Tabla: `deleted_users_archive` — conserva metadatos por 5 años.
- `POST /api/account/request-deletion` → inserta en `account_deletion_requests`, `scheduled_for = now() + 30 days`.
- `POST /api/account/cancel-deletion` → setea `cancelled_at = now()`.
- Cron `execute-deletions` — 3 AM UTC — elimina cuentas donde `scheduled_for <= now() AND cancelled_at IS NULL AND executed_at IS NULL`.
- Cron `send-reminders` — 4 AM UTC — envía recordatorio cuando faltan 6-8 días.
- Emails: `deletion_warning`, `deletion_cancelled`, `deletion_reminder`, `deletion_confirmed`.
- Banner naranja en bóveda: `quota.deletion_requested_at` → handler `handleCancelDeletion()`.

---

### 8. Seguridad y privacidad (`security`) — Rojo

**Intro:** Tus documentos están protegidos con los más altos estándares de seguridad.

**Pasos:**
1. **Cifrado en reposo** — Archivos cifrados en Supabase (AWS). Sin acceso externo.
2. **Acceso exclusivo** — Solo el usuario puede ver sus documentos. Ni el administrador accede al contenido.
3. **URLs con expiración** — Los enlaces de vista previa expiran en 15 minutos.
4. **Eliminar tu cuenta** — Configuración → Eliminar cuenta. Período de gracia de 30 días.

**Notas:**
- (Legal) Ley 1581 de 2012 (Habeas Data Colombia).
- (Privacidad) No se comparte ni vende información a terceros.

**Respaldo técnico:**
- Aislamiento por RLS (Row Level Security) en Supabase: cada consulta lleva el JWT del usuario.
- Storage paths: `{userId}/{filename}` — solo accesible con `service_role` o el propio usuario.
- URLs firmadas: `createSignedUrl(..., 900)` — 900 segundos de vigencia.

---

## Tabla comparativa de planes (`PLAN_COMPARISON`)

| Característica          | Gratuito        | Premium          | Empresarial       |
|-------------------------|-----------------|------------------|-------------------|
| Almacenamiento          | 50 MB           | 500 MB           | 5 GB              |
| Documentos máximos      | 15              | 200              | Ilimitados        |
| Tamaño máx. por archivo | 5 MB            | 50 MB            | 100 MB            |
| Formatos                | Docs + Imágenes | + Audio y Video  | + Audio y Video   |
| Alertas en pantalla     | ✓               | ✓                | ✓                 |
| Correos de recordatorio | —               | ✓                | ✓                 |
| Nota de recordatorio    | —               | ✓                | ✓                 |
| Categorías              | 6 predefinidas  | Hasta 25         | Ilimitadas        |
| Panel de administrador  | —               | —                | ✓                 |
| Soporte                 | Comunidad       | Prioritario      | 24/7 dedicado     |

**Respaldo en BD (tabla `plans`):**

| Columna              | free     | premium  | enterprise |
|----------------------|----------|----------|------------|
| `storage_quota_bytes`| 50 MB    | 500 MB   | 5 GB       |
| `max_documents`      | 15       | 200      | NULL       |
| `max_file_size_mb`   | 5        | 50       | 100        |
| `allow_media_files`  | FALSE    | TRUE     | TRUE       |
| `max_categories`     | 6        | 25       | NULL       |

---

## Datos de planes (precios y condiciones de negocio)

| Plan        | Precio (COP/mes) | Almacenamiento | Usuarios objetivo |
|-------------|------------------|----------------|-------------------|
| Gratuito    | $0               | 50 MB          | Usuarios nuevos   |
| Premium     | $9.900           | 500 MB         | Individuos activos|
| Empresarial | $29.900          | 5 GB           | PYMEs, equipos    |

Precios definidos para el mercado colombiano. Sin integración de pago real implementada aún.

---

## Flujos clave del sistema (resumen para la guía)

### Carga de archivos
1. Cliente valida con `validateFile()` (tipo + tamaño según plan).
2. `POST /api/upload` — valida server-side contra `plans` en BD.
3. Sube a Supabase Storage en `documents/{userId}/{uuid}-{filename}`.
4. Inserta registro en tabla `documents`.
5. Actualiza `profiles.storage_used_bytes`.

### Obtención de URL para vista previa
1. `GET /api/documents/url?id={docId}`
2. Busca ruta en `documents.storage_path`.
3. Genera URL firmada con Supabase Storage (15 min de vigencia).
4. Devuelve `{ url }` al cliente.

### Mover documento entre categorías
1. Clic en botón `FolderInput` → dropdown.
2. Selección de categoría → `PATCH /api/documents/[id]` con `{ category_id }`.
3. Actualiza `documents.category_id` en BD.
4. Refresca lista en cliente.

### Editar fecha de vencimiento
1. Clic en ícono `Pencil` → input inline.
2. Guardar → `PATCH /api/documents` con `{ documentId, expiry_date, expiry_note }`.
3. Actualiza `documents.expiry_date` y `documents.expiry_note` en BD.

---

## Archivos relacionados

| Archivo | Propósito |
|---------|-----------|
| `src/app/dashboard/guide/page.tsx` | Página principal de la guía |
| `src/app/dashboard/page.tsx` | Dashboard (bóveda) con toda la lógica de documentos |
| `src/components/OnboardingPanel.tsx` | Panel de primeros pasos (link a guía) |
| `src/app/dashboard/layout.tsx` | Layout con nav link "Guía de uso" |
| `src/app/dashboard/settings/page.tsx` | Cancelación de plan y solicitud de baja |
| `src/app/dashboard/pricing/page.tsx` | Página de planes con precios |
| `src/utils/fileValidation.ts` | Validación client-side de archivos |
| `src/app/api/upload/route.ts` | Validación server-side y carga |
| `ACCOUNT_DELETION_MODULE.md` | Documentación completa del módulo de baja |
| `EXPIRY_REMINDERS_PLAN.md` | Documentación del sistema de alertas de vencimiento |
| `supabase/migrations/052_plans_media_and_file_limits.sql` | Migración de límites y media por plan |
