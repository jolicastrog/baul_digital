# Plan de Desarrollo — Módulo de Recordatorios de Vencimiento de Documentos

**Proyecto:** Baúl Digital  
**Fecha del plan:** 2026-04-27  
**Estado:** Pendiente de implementación

---

## Índice

1. [Visión general](#1-visión-general)
2. [Arquitectura del módulo](#2-arquitectura-del-módulo)
3. [Fase 1 — Base de datos](#3-fase-1--base-de-datos)
4. [Fase 2 — Infraestructura de email](#4-fase-2--infraestructura-de-email)
5. [Fase 3 — Cron job](#5-fase-3--cron-job)
6. [Fase 4 — API del administrador](#6-fase-4--api-del-administrador)
7. [Fase 5 — Interfaz del administrador](#7-fase-5--interfaz-del-administrador)
8. [Fase 6 — Configuración de Vercel](#8-fase-6--configuración-de-vercel)
9. [Mapa completo de archivos](#9-mapa-completo-de-archivos)
10. [Escenarios cubiertos](#10-escenarios-cubiertos)
11. [Checklist de pruebas](#11-checklist-de-pruebas)

---

## 1. Visión general

### Qué hace este módulo

Envía automáticamente correos electrónicos a usuarios de planes **Premium** y **Enterprise** recordándoles que uno o más de sus documentos está próximo a vencer. Los envíos se configuran como "ventanas" de días antes del vencimiento (por defecto: 30, 8 y 1 día).

### Principios de diseño

- **Completamente independiente** del módulo de alertas visuales (`alerts` table) que ya existe y sirve para el dashboard.
- **Configurable por el administrador** sin tocar código: número de ventanas, días de cada ventana, activar/desactivar ventanas individuales, apagar todo el sistema.
- **Tolerante a cambios**: si el usuario cambia o elimina la fecha de vencimiento, los recordatorios pendientes se recalculan automáticamente mediante triggers en BD.
- **Anti-duplicados**: el estado vive en la BD — el cron nunca puede enviar el mismo email dos veces.
- **Solo para planes de pago**: el sistema nunca envía a cuentas `free`, verificado en tiempo de ejecución del cron.

### Lo que ya existe y se reutiliza

| Pieza existente | Cómo se reutiliza |
|-----------------|-------------------|
| `sendEmail()` + Resend | Envío y registro en `email_logs` |
| `email_logs` | Auditoría general de todos los envíos |
| Patrón de cron (send-reminders) | Estructura idéntica para el nuevo cron |
| `verifyAdmin()` | Autenticación de los endpoints admin |
| `profiles.plan_type` | Filtro premium/enterprise en tiempo de envío |
| `documents.expiry_note` | Se lee en el cron y se incluye en el email |
| Patrón de admin pages (deletions/page.tsx) | Referencia de UI para la nueva página |

---

## 2. Arquitectura del módulo

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMINISTRADOR                             │
│   /admin/expiry-reminders                                   │
│   • Interruptor global ON/OFF                               │
│   • Lista de reglas (días, etiqueta, activa)                │
│   • Crear / editar / eliminar reglas                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ PATCH/POST/DELETE
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              API /api/admin/expiry-reminders                │
│  verifyAdmin() → opera sobre las tablas de configuración    │
└──────────┬────────────────────────────────────────┬─────────┘
           │ lee                                    │ escribe
           ▼                                        ▼
┌──────────────────────┐              ┌─────────────────────────┐
│ expiry_reminder_     │              │ expiry_reminder_rules   │
│ settings             │              │ (días configurables)    │
│ (interruptor global) │              │                         │
└──────────────────────┘              └────────────┬────────────┘
                                                   │ trigger al
                                                   │ cambiar regla
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   documents (tabla existente)               │
│   expiry_date, expiry_note                                  │
└──────────┬──────────────────────────────────────────────────┘
           │ AFTER INSERT / AFTER UPDATE (expiry_date)
           │ trigger lee expiry_reminder_rules activas
           ▼
┌─────────────────────────────────────────────────────────────┐
│              document_expiry_emails                         │
│  Cola de envíos futuros con estado propio                   │
│  status: pending | sent | failed | skipped | cancelled      │
└──────────────────────┬──────────────────────────────────────┘
                       │ SELECT WHERE scheduled_date <= hoy
                       │         AND status = 'pending'
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         CRON /api/cron/send-expiry-reminders (7am UTC)      │
│  1. Verifica interruptor global                             │
│  2. Obtiene pendientes del día                              │
│  3. Filtra plan_type != 'free'                              │
│  4. sendEmail() → Resend → email_logs                       │
│  5. UPDATE status = sent/failed/skipped                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Fase 1 — Base de datos

### Migración `050_expiry_reminder_config.sql`

Crea las dos tablas de configuración.

#### Tabla `expiry_reminder_settings` — interruptor global

```sql
CREATE TABLE expiry_reminder_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reminders_enabled BOOLEAN    NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

-- Singleton: siempre existe exactamente una fila
INSERT INTO expiry_reminder_settings (reminders_enabled) VALUES (TRUE);

-- Solo service_role puede modificarla
ALTER TABLE expiry_reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON expiry_reminder_settings
  USING (false) WITH CHECK (false);
```

#### Tabla `expiry_reminder_rules` — reglas configurables

```sql
CREATE TABLE expiry_reminder_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  days_before INT         NOT NULL CHECK (days_before > 0),
  label       TEXT        NOT NULL,           -- "30 días antes", "1 día antes", etc.
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INT         NOT NULL DEFAULT 0, -- orden visual en el panel admin
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (days_before)
);

-- Reglas iniciales
INSERT INTO expiry_reminder_rules (days_before, label, is_active, sort_order) VALUES
  (30, '30 días antes', TRUE, 1),
  (8,  '8 días antes',  TRUE, 2),
  (1,  '1 día antes',   TRUE, 3);

ALTER TABLE expiry_reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON expiry_reminder_rules
  USING (false) WITH CHECK (false);
```

---

### Migración `051_document_expiry_emails.sql`

Crea la tabla principal de cola de envíos y todos sus triggers.

#### Tabla `document_expiry_emails`

```sql
CREATE TABLE document_expiry_emails (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID        NOT NULL REFERENCES documents(id)  ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  rule_id        UUID        REFERENCES expiry_reminder_rules(id) ON DELETE SET NULL,
  days_before    INT         NOT NULL CHECK (days_before > 0),
  scheduled_date DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','sent','failed','skipped','cancelled')),
  sent_at        TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, days_before)
);

-- Índices
CREATE INDEX idx_dee_scheduled_pending
  ON document_expiry_emails (scheduled_date)
  WHERE status = 'pending';

CREATE INDEX idx_dee_document_id ON document_expiry_emails (document_id);
CREATE INDEX idx_dee_user_id     ON document_expiry_emails (user_id);
CREATE INDEX idx_dee_status      ON document_expiry_emails (status);

ALTER TABLE document_expiry_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON document_expiry_emails
  USING (false) WITH CHECK (false);
```

> **Por qué `rule_id` puede ser NULL (ON DELETE SET NULL):** si el admin elimina una regla,
> los registros históricos (sent/failed) conservan su información sin romper la FK.
> Los registros `pending` de esa regla se cancelan antes por trigger (ver abajo).

#### Función compartida — programar envíos para un documento

```sql
CREATE OR REPLACE FUNCTION schedule_expiry_emails_for_document(
  p_document_id UUID,
  p_expiry_date DATE,
  p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rule        RECORD;
  v_sched_date  DATE;
BEGIN
  -- Leer reglas activas en el momento de crear el documento
  FOR v_rule IN
    SELECT id, days_before FROM expiry_reminder_rules WHERE is_active = TRUE
  LOOP
    v_sched_date := p_expiry_date - v_rule.days_before;

    -- Solo crear si la fecha programada es hoy o en el futuro
    IF v_sched_date >= CURRENT_DATE THEN
      INSERT INTO document_expiry_emails
        (document_id, user_id, rule_id, days_before, scheduled_date)
      VALUES
        (p_document_id, p_user_id, v_rule.id, v_rule.days_before, v_sched_date)
      ON CONFLICT (document_id, days_before) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
```

#### Trigger 1 — Documento nuevo con fecha de vencimiento

```sql
CREATE OR REPLACE FUNCTION trg_fn_document_insert_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    PERFORM schedule_expiry_emails_for_document(NEW.id, NEW.expiry_date, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_document_insert_expiry
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION trg_fn_document_insert_expiry();
```

#### Trigger 2 — Fecha de vencimiento cambiada o eliminada

```sql
CREATE OR REPLACE FUNCTION trg_fn_document_update_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Solo actuar si la fecha cambió
  IF OLD.expiry_date IS NOT DISTINCT FROM NEW.expiry_date THEN
    RETURN NEW;
  END IF;

  -- Cancelar todos los pendientes del documento
  UPDATE document_expiry_emails
    SET status = 'cancelled'
  WHERE document_id = NEW.id AND status = 'pending';

  -- Si la nueva fecha no es null, recalcular
  IF NEW.expiry_date IS NOT NULL THEN
    PERFORM schedule_expiry_emails_for_document(NEW.id, NEW.expiry_date, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_document_update_expiry
AFTER UPDATE ON documents
FOR EACH ROW
WHEN (OLD.expiry_date IS DISTINCT FROM NEW.expiry_date)
EXECUTE FUNCTION trg_fn_document_update_expiry();
```

> **Eliminación de documento:** no necesita trigger. La FK `ON DELETE CASCADE`
> elimina automáticamente todas las filas de `document_expiry_emails`.

#### Trigger 3 — Regla desactivada → cancelar sus pendientes

```sql
CREATE OR REPLACE FUNCTION trg_fn_rule_deactivated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Si la regla pasó de activa a inactiva
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    UPDATE document_expiry_emails
      SET status = 'cancelled'
    WHERE days_before = NEW.days_before AND status = 'pending';
  END IF;

  -- Si la regla se reactivó o se creó → backfill de documentos existentes
  IF (OLD.is_active = FALSE AND NEW.is_active = TRUE)
     OR (TG_OP = 'INSERT' AND NEW.is_active = TRUE) THEN
    PERFORM backfill_expiry_reminders_for_rule(NEW.days_before, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rule_deactivated
AFTER INSERT OR UPDATE ON expiry_reminder_rules
FOR EACH ROW
EXECUTE FUNCTION trg_fn_rule_deactivated();
```

#### Función de backfill — documentos existentes al activar una regla nueva

```sql
CREATE OR REPLACE FUNCTION backfill_expiry_reminders_for_rule(
  p_days_before INT,
  p_rule_id     UUID
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO document_expiry_emails
    (document_id, user_id, rule_id, days_before, scheduled_date)
  SELECT
    d.id,
    d.user_id,
    p_rule_id,
    p_days_before,
    d.expiry_date - p_days_before
  FROM documents d
  JOIN profiles p ON p.id = d.user_id
  WHERE d.expiry_date IS NOT NULL
    AND d.expiry_date > CURRENT_DATE                      -- documento no vencido
    AND d.expiry_date - p_days_before >= CURRENT_DATE     -- recordatorio aún en el futuro
    AND p.plan_type IN ('premium', 'enterprise')          -- solo planes de pago
  ON CONFLICT (document_id, days_before) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

> **Cuándo se llama `backfill`:**
> - Al activar una regla que estaba desactivada.
> - Al crear una regla nueva con `is_active = TRUE`.
> En ambos casos el trigger la invoca automáticamente.

---

## 4. Fase 2 — Infraestructura de email

### 4.1 Actualizar `src/lib/email/sendEmail.ts`

Agregar `'expiry_reminder'` al tipo `EmailTemplate`:

```typescript
export type EmailTemplate =
  | 'deletion_warning'
  | 'deletion_confirmed'
  | 'deletion_cancelled'
  | 'deletion_reminder'
  | 'subscription_cancelled'
  | 'expiry_reminder';          // ← nuevo
```

### 4.2 Crear template en `src/lib/email/templates.ts`

**Un solo template adaptativo** — el nivel de urgencia (color, texto, tono) se determina
por `daysRemaining`. Esto soporta cualquier valor que el admin configure, no solo 30/8/1.

```typescript
interface ExpiryReminderOpts {
  fullName:     string;
  documentName: string;
  expiryDate:   string;   // formateado: "1 de mayo de 2026"
  daysRemaining: number;
  expiryNote?:  string | null;
}

export function expiryReminderHtml(opts: ExpiryReminderOpts): string {
  const { fullName, documentName, expiryDate, daysRemaining, expiryNote } = opts;

  // Urgencia dinámica
  const urgency =
    daysRemaining <= 1  ? { color: '#ef4444', label: '¡Vence mañana!',    tone: 'crítico'     } :
    daysRemaining <= 8  ? { color: '#f97316', label: 'Vence pronto',      tone: 'urgente'     } :
                          { color: '#3b82f6', label: 'Aviso de vencimiento', tone: 'informativo' };

  const noteSection = expiryNote
    ? `<div style="background:#1e293b;border-left:3px solid ${urgency.color};padding:12px 16px;margin:16px 0;border-radius:4px;">
         <p style="margin:0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tu recordatorio</p>
         <p style="margin:6px 0 0;color:#e2e8f0;font-size:14px;">${expiryNote}</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#0f172a;color:#e2e8f0;font-family:sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:12px;overflow:hidden;">

    <!-- Header -->
    <div style="background:${urgency.color};padding:24px;text-align:center;">
      <p style="margin:0;color:#fff;font-size:13px;opacity:.85;">Baúl Digital</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;">${urgency.label}</h1>
    </div>

    <!-- Cuerpo -->
    <div style="padding:28px 32px;">
      <p>Hola, <strong>${fullName}</strong>.</p>
      <p>Tu documento <strong>${documentName}</strong> vence el
         <strong>${expiryDate}</strong>
         ${daysRemaining === 1 ? '(mañana)' : `en <strong>${daysRemaining} días</strong>`}.
      </p>

      ${noteSection}

      <div style="text-align:center;margin:28px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
           style="background:${urgency.color};color:#fff;padding:12px 28px;border-radius:8px;
                  text-decoration:none;font-weight:600;font-size:14px;">
          Ver mis documentos
        </a>
      </div>

      <p style="font-size:13px;color:#64748b;">
        Si este documento ya fue renovado o no requiere acción, puedes ignorar este correo.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #334155;text-align:center;">
      <p style="margin:0;font-size:12px;color:#475569;">
        Baúl Digital · Solo tú tienes acceso a tus documentos
      </p>
    </div>
  </div>
</body>
</html>`;
}
```

**Por qué un solo template y no tres:**
Las reglas son configurables — el admin puede crear una ventana de 15 días, 45 días, etc.
Tener un template adaptativo evita tener que crear un template por cada regla nueva.
El color y el tono cambian automáticamente según los días restantes.

---

## 5. Fase 3 — Cron job

### Archivo: `src/app/api/cron/send-expiry-reminders/route.ts`

```typescript
// POST — Vercel Cron (7:00 AM UTC = 2:00 AM Colombia)
// Authorization: Bearer CRON_SECRET
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {

  // 1. Autenticación del cron
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // 2. Verificar interruptor global
  const { data: settings } = await supabaseAdmin
    .from('expiry_reminder_settings')
    .select('reminders_enabled')
    .single();

  if (!settings?.reminders_enabled) {
    console.log('[expiry-reminders] Sistema desactivado por el admin.');
    return NextResponse.json({ success: true, skipped: 'disabled' });
  }

  // 3. Obtener pendientes del día (hoy y atrasados del día anterior por uploads tardíos)
  const { data: pending } = await supabaseAdmin
    .from('document_expiry_emails')
    .select(`
      id, days_before, document_id, user_id,
      documents ( file_name, expiry_date, expiry_note ),
      profiles  ( email, full_name, plan_type )
    `)
    .lte('scheduled_date', new Date().toISOString().split('T')[0])  // hoy o anterior
    .eq('status', 'pending');

  if (!pending?.length) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let sent = 0, skipped = 0, failed = 0;

  for (const row of pending) {
    const profile  = row.profiles  as any;
    const document = row.documents as any;

    // 4. Saltar si es plan free
    if (!profile || profile.plan_type === 'free') {
      await supabaseAdmin
        .from('document_expiry_emails')
        .update({ status: 'skipped' })
        .eq('id', row.id);
      skipped++;
      continue;
    }

    // 5. Formatear datos para el template
    const expiryDate = new Date(document.expiry_date).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    try {
      await sendEmail({
        to:       profile.email,
        subject:  `Tu documento "${document.file_name}" vence en ${row.days_before} día${row.days_before === 1 ? '' : 's'} — Baúl Digital`,
        html:     expiryReminderHtml({
          fullName:      profile.full_name ?? profile.email,
          documentName:  document.file_name,
          expiryDate,
          daysRemaining: row.days_before,
          expiryNote:    document.expiry_note ?? null,
        }),
        template: 'expiry_reminder',
        userId:   row.user_id,
        metadata: {
          document_id:   row.document_id,
          days_before:   row.days_before,
          expiry_date:   document.expiry_date,
        },
      });

      // 6. Marcar como enviado
      await supabaseAdmin
        .from('document_expiry_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);

      sent++;
    } catch (err: any) {
      // 7. Marcar como fallido
      await supabaseAdmin
        .from('document_expiry_emails')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', row.id);
      failed++;
    }
  }

  console.log(`[expiry-reminders] sent=${sent} skipped=${skipped} failed=${failed}`);
  return NextResponse.json({ success: true, sent, skipped, failed });
}
```

**Nota sobre uploads tardíos:** el cron usa `lte('scheduled_date', hoy)` en lugar de `eq`.
Así recupera registros cuyo `scheduled_date` era ayer pero el cron ya había corrido cuando
se subió el documento. Esto evita que el usuario pierda un recordatorio por un timing edge case.

---

## 6. Fase 4 — API del administrador

### Estructura de rutas

```
/api/admin/expiry-reminders/
├── route.ts          → GET (estado general) | PATCH (toggle global)
└── rules/
    ├── route.ts      → GET (lista reglas) | POST (crear regla)
    └── [id]/
        └── route.ts  → PATCH (editar/toggle) | DELETE (eliminar)
```

### `GET /api/admin/expiry-reminders`

Devuelve el estado completo: interruptor global + todas las reglas ordenadas.

```json
{
  "reminders_enabled": true,
  "rules": [
    { "id": "uuid", "days_before": 30, "label": "30 días antes", "is_active": true, "sort_order": 1 },
    { "id": "uuid", "days_before": 8,  "label": "8 días antes",  "is_active": true, "sort_order": 2 },
    { "id": "uuid", "days_before": 1,  "label": "1 día antes",   "is_active": true, "sort_order": 3 }
  ]
}
```

### `PATCH /api/admin/expiry-reminders`

Activa o desactiva el sistema completo.

```json
// Body
{ "reminders_enabled": false }
```

> Al desactivar, los pendientes **no se cancelan** — si se vuelve a activar, el cron los
> procesará en su próxima ejecución. Esto evita perder recordatorios legítimos.

### `POST /api/admin/expiry-reminders/rules`

Crea una nueva regla. El trigger en BD hace el backfill automáticamente.

```json
// Body
{ "days_before": 15, "label": "15 días antes", "is_active": true }
```

### `PATCH /api/admin/expiry-reminders/rules/[id]`

Edita una regla existente (label, is_active, sort_order).

```json
// Body — cualquier combinación de:
{ "label": "Dos semanas antes", "is_active": false, "sort_order": 2 }
```

> Si `is_active` cambia a `false`, el trigger cancela los `pending` de ese `days_before`.
> Si cambia a `true`, el trigger hace backfill de documentos existentes.

### `DELETE /api/admin/expiry-reminders/rules/[id]`

Elimina una regla. Antes de eliminar, el API cancela los `pending` de ese `days_before`
(los registros `sent`/`failed` quedan con `rule_id = NULL` por el `ON DELETE SET NULL`).

---

## 7. Fase 5 — Interfaz del administrador

### Archivo: `src/app/admin/expiry-reminders/page.tsx`

Página en el panel admin con dos secciones:

#### Sección 1 — Control global

```
┌─────────────────────────────────────────────────────┐
│  Recordatorios de Vencimiento                       │
│                                                     │
│  Sistema de recordatorios    [  ● Activo  ]  toggle │
│  Los usuarios Premium y Enterprise recibirán        │
│  emails antes de que sus documentos venzan.         │
└─────────────────────────────────────────────────────┘
```

Toggle que llama `PATCH /api/admin/expiry-reminders`.

#### Sección 2 — Tabla de reglas

```
┌─────────┬──────────────────┬──────────┬──────────────────────┐
│ Días    │ Etiqueta         │ Estado   │ Acciones             │
├─────────┼──────────────────┼──────────┼──────────────────────┤
│ 30      │ 30 días antes    │ ● Activa │ [Editar] [Eliminar]  │
│ 8       │ 8 días antes     │ ● Activa │ [Editar] [Eliminar]  │
│ 1       │ 1 día antes      │ ● Activa │ [Editar] [Eliminar]  │
└─────────┴──────────────────┴──────────┴──────────────────────┘
                                    [ + Agregar regla ]
```

- **Toggle de estado**: activa/desactiva individualmente (PATCH).
- **Editar**: modal inline para cambiar días y etiqueta.
- **Eliminar**: confirmación + DELETE.
- **Agregar regla**: modal con campo `days_before` y `label`.

#### Sección 3 — Estadísticas (opcional, fase futura)

Números de envíos de los últimos 30 días consultando `document_expiry_emails`:
- Total enviados (`sent`)
- Total fallidos (`failed`)
- Total omitidos por plan free (`skipped`)

---

## 8. Fase 6 — Configuración de Vercel

### Actualizar `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/expire-subscriptions",    "schedule": "0 1 * * *" },
    { "path": "/api/cron/execute-deletions",       "schedule": "0 3 * * *" },
    { "path": "/api/cron/send-reminders",          "schedule": "0 4 * * *" },
    { "path": "/api/cron/purge-archives",          "schedule": "0 2 1 1 *" },
    { "path": "/api/cron/send-expiry-reminders",   "schedule": "0 7 * * *" }
  ]
}
```

**7:00 AM UTC = 2:00 AM Colombia.** El cron corre antes de que el usuario empiece el día,
asegurando que el email llegue en la mañana hora local.

---

## 9. Mapa completo de archivos

### Archivos nuevos a crear

| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/050_expiry_reminder_config.sql` | Tablas `expiry_reminder_settings` y `expiry_reminder_rules` |
| `supabase/migrations/051_document_expiry_emails.sql` | Tabla `document_expiry_emails`, función `schedule_expiry_emails_for_document`, función `backfill_expiry_reminders_for_rule`, Trigger 1 (insert doc), Trigger 2 (update expiry_date), Trigger 3 (rule change) |
| `src/app/api/cron/send-expiry-reminders/route.ts` | Cron job de envío |
| `src/app/api/admin/expiry-reminders/route.ts` | GET estado global + PATCH toggle |
| `src/app/api/admin/expiry-reminders/rules/route.ts` | GET lista + POST crear regla |
| `src/app/api/admin/expiry-reminders/rules/[id]/route.ts` | PATCH editar + DELETE eliminar |
| `src/app/admin/expiry-reminders/page.tsx` | UI del panel admin |

### Archivos existentes a modificar

| Archivo | Qué se modifica |
|---------|-----------------|
| `src/lib/email/sendEmail.ts` | Agregar `'expiry_reminder'` al tipo `EmailTemplate` |
| `src/lib/email/templates.ts` | Agregar función `expiryReminderHtml()` |
| `vercel.json` | Agregar schedule del nuevo cron |

### Archivos que NO se tocan

| Archivo | Por qué |
|---------|---------|
| `supabase/migrations/001_init_schema.sql` | La tabla `alerts` existente no se modifica |
| `src/app/api/documents/route.ts` | Los triggers en BD manejan todo automáticamente |
| `src/app/api/upload/route.ts` | Los triggers en BD manejan todo automáticamente |
| Resto del admin panel | Solo se agrega una nueva página |

---

## 10. Escenarios cubiertos

| Escenario | Comportamiento |
|-----------|---------------|
| Upload con fecha 31 días en el futuro | Crea 3 filas: 30d ✓, 8d ✓, 1d ✓ |
| Upload con fecha 9 días en el futuro | Crea 2 filas: 30d ✗ (pasó), 8d ✓, 1d ✓ |
| Upload con fecha 5 días en el futuro | Crea 1 fila: 30d ✗, 8d ✗, 1d ✓ |
| Upload con fecha hoy o ayer | No crea ninguna fila |
| Upload SIN fecha de vencimiento | No crea ninguna fila |
| Usuario cambia fecha a una más lejana | Cancela pendientes, crea nuevos según nueva fecha |
| Usuario cambia fecha a una más próxima | Cancela pendientes, crea los que apliquen |
| Usuario quita la fecha | Cancela todos los pendientes |
| Usuario elimina el documento | CASCADE borra todas las filas |
| Cron corre y usuario es plan free | Marca `skipped`, no envía |
| Cron corre y usuario es premium/enterprise | Envía email, marca `sent` |
| Resend falla el envío | Marca `failed` con `error_message`, visible para el admin |
| Admin desactiva una regla (ej. 30 días) | Cancela todos los `pending` con `days_before = 30` |
| Admin reactiva la regla | Backfill automático de documentos existentes |
| Admin crea regla nueva (ej. 15 días) | Backfill automático de todos los docs elegibles |
| Admin apaga el sistema global | El cron detecta `reminders_enabled = false` y no hace nada |
| Admin cambia `days_before` de una regla | Cancelar pendientes de valor antiguo, recalcular con nuevo valor |
| Documento subido después de que el cron corrió hoy | El cron del día siguiente lo recupera (`lte` en lugar de `eq`) |

---

## 11. Checklist de pruebas

### Base de datos
- [ ] Subir documento con fecha 35 días en el futuro → verificar 3 filas creadas en `document_expiry_emails`
- [ ] Subir documento con fecha 5 días en el futuro → verificar 1 fila creada
- [ ] Cambiar fecha del documento → verificar que las anteriores quedan `cancelled` y se crean nuevas
- [ ] Quitar fecha del documento → verificar que todas quedan `cancelled`
- [ ] Eliminar documento → verificar que no quedan filas huérfanas (CASCADE)
- [ ] Crear regla nueva (ej. 15 días) → verificar backfill de documentos existentes elegibles
- [ ] Desactivar regla → verificar que sus `pending` quedan `cancelled`
- [ ] Reactivar regla → verificar backfill

### Cron job
- [ ] Insertar manualmente una fila con `scheduled_date = hoy` y `status = 'pending'` en usuario premium → llamar el endpoint → verificar email recibido y estado `sent`
- [ ] Misma prueba con usuario free → verificar estado `skipped` y que no llega email
- [ ] Con `reminders_enabled = false` → verificar que el cron responde `skipped: disabled`
- [ ] Simular fallo de Resend → verificar estado `failed` con `error_message`

### Email
- [ ] Con `daysRemaining = 1` → email en rojo con tono urgente
- [ ] Con `daysRemaining = 8` → email en naranja
- [ ] Con `daysRemaining = 30` → email en azul, tono informativo
- [ ] Con `expiryNote` presente → verificar que aparece en el email
- [ ] Sin `expiryNote` → verificar que la sección de nota no aparece

### Admin UI
- [ ] Toggle global apaga/enciende el sistema
- [ ] Crear nueva regla → aparece en la lista
- [ ] Desactivar regla → toggle cambia, pendientes se cancelan en BD
- [ ] Eliminar regla → desaparece de la lista
- [ ] Editar días y etiqueta → se actualizan correctamente

---

## Orden de implementación recomendado

```
1. Migración 050 → aplicar en Supabase
2. Migración 051 → aplicar en Supabase
3. sendEmail.ts → agregar tipo
4. templates.ts → agregar expiryReminderHtml
5. Cron route → crear send-expiry-reminders
6. vercel.json → agregar schedule
7. API admin routes → 4 archivos
8. Admin UI page → 1 archivo
9. Pruebas BD → manual en Supabase SQL editor
10. Prueba cron → llamada manual con Postman/curl
11. Deploy → push a main → Vercel
```

**Estimado total: 2 días de desarrollo.**
