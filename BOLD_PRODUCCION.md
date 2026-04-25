# Bold Pasarela de Pagos — De Pruebas a Producción

Documento de referencia para cancelar el entorno de pruebas Bold y activar el entorno de producción real.

---

## Estado actual del modo pruebas (lo que está configurado ahora)

### Variables en Vercel (Environment Variables)

| Variable | Valor actual (pruebas) | Notas |
|----------|------------------------|-------|
| `BOLD_API_KEY` | `BjH8lItJsDn81m8k6pOl4iHYuBCbB0FLwouyHk6Jgak` | Llave de identidad de pruebas |
| `BOLD_SECRET_KEY` | `nUGdCr8dVet_Y5sxz1cJ4w` | Llave secreta de pruebas |
| `BOLD_API_URL` | `https://integrations.api.bold.co` | Misma URL en pruebas y producción |
| `BOLD_SKIP_SIGNATURE` | `1` | **TEMPORAL** — saltea la validación HMAC del webhook |

### Webhook configurado en Bold (panel de pruebas)
- **URL**: `https://www.mibauldigital.com/api/webhooks/bold`
- **Llave de identidad**: `BjH8lItJsDn81m8k6pOl4iHYuBCbB0FLwouyHk6Jgak` (la de pruebas)

### Código con logs de diagnóstico (temporales)
- `src/app/api/payments/create-bold-link/route.ts` — varios `console.log` de diagnóstico
- `src/app/api/webhooks/bold/route.ts` — logs de rawBody, reference, resultado del RPC

---

## Pasos completos para pasar a producción

### PASO 1 — Obtener las llaves de producción en Bold

1. Inicia sesión en el panel de Bold: [https://commerce.bold.co](https://commerce.bold.co)
2. Ve a **Configuración → Integración** (o **Desarrolladores → API Keys**)
3. Asegúrate de estar en **Modo producción** (no en "Modo de pruebas")
4. Copia las dos llaves de producción:
   - **Llave de identidad (API Key)** — empieza diferente a la de pruebas
   - **Llave secreta (Secret Key)** — usada para firmar los webhooks

> ⚠️ Las llaves de producción son distintas a las de pruebas aunque el panel se vea igual. Verifica que el modo activo sea producción antes de copiarlas.

---

### PASO 2 — Actualizar las variables en Vercel

1. Ve a [vercel.com](https://vercel.com) → proyecto `baul_digital` → **Settings → Environment Variables**
2. Edita o reemplaza las siguientes variables (en los entornos **Production** y **Preview**):

| Variable | Nuevo valor |
|----------|-------------|
| `BOLD_API_KEY` | *(llave de identidad de producción obtenida en Paso 1)* |
| `BOLD_SECRET_KEY` | *(llave secreta de producción obtenida en Paso 1)* |
| `BOLD_API_URL` | `https://integrations.api.bold.co` *(no cambia)* |
| `BOLD_SKIP_SIGNATURE` | **ELIMINAR esta variable** — no dejarla en `0` ni vacía, eliminarla completamente |

3. Después de guardar, Vercel generará un nuevo deploy automáticamente. Espera que termine (~2 minutos).

---

### PASO 3 — Arreglar la validación de firma del webhook (HMAC)

Actualmente la firma se saltea con `BOLD_SKIP_SIGNATURE=1`. En producción esto debe funcionar correctamente.

**Cómo funciona la firma Bold:**
Bold envía el header `x-bold-signature` con un HMAC-SHA256 del cuerpo del request firmado con tu `BOLD_SECRET_KEY`.

**El código actual en** `src/app/api/webhooks/bold/route.ts` **(función `validateBoldSignature`):**

```ts
function validateBoldSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.BOLD_SECRET_KEY ?? '';
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf      = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedHex);
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
```

**Diagnóstico pendiente:** en modo pruebas la firma no coincidía. Con las llaves de producción puede funcionar directamente. Para verificarlo:

1. Elimina `BOLD_SKIP_SIGNATURE` de Vercel (Paso 2)
2. Haz un pago de prueba con las llaves de producción
3. Revisa los logs de Vercel. Si aparece `[bold-webhook] Firma inválida`, ejecuta este diagnóstico en los logs:

```
expected hex: <valor>
signature recibida: <valor>
```

Si los primeros 20 caracteres no coinciden, Bold puede estar enviando la firma en base64 en lugar de hex. En ese caso cambia en el código:

```ts
// Cambiar .digest('hex') por .digest('base64') si Bold envía base64
const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
```

> Si en producción la firma sigue fallando, consulta la documentación oficial:
> [https://developers.bold.co/pagos-en-linea/webhooks](https://developers.bold.co/pagos-en-linea/webhooks)

---

### PASO 4 — Registrar el webhook de producción en Bold

1. En el panel de Bold (modo producción) ve a **Configuración → Webhooks**
2. Registra el webhook con:
   - **URL**: `https://www.mibauldigital.com/api/webhooks/bold`
   - **Llave de identidad**: *(la llave de identidad de producción)*
3. Guarda el webhook

---

### PASO 5 — Limpiar los logs de diagnóstico del código

Una vez que el flujo de producción funcione correctamente, elimina los `console.log` temporales de los siguientes archivos. Hazlo editando localmente y haciendo commit:

#### `src/app/api/payments/create-bold-link/route.ts`
Eliminar estas líneas:
```ts
console.log('[create-bold-link] Plan desde BD:', { ... });
console.log('[create-bold-link] Cálculo:', { billingCycle, rate, months, totalAmount });
console.log('[create-bold-link] referenceId:', referenceId);
console.log('[create-bold-link] Bold response:', JSON.stringify(boldData));
```

#### `src/app/api/webhooks/bold/route.ts`
Eliminar estas líneas:
```ts
console.log('[bold-webhook] rawBody completo:', rawBody);
console.log('[bold-webhook] event type:', ...);
console.log('[bold-webhook] reference:', reference);
console.log('[bold-webhook] parsed:', ...);
console.log('[bold-webhook] procesando pago aprobado para:', ...);
console.log('[bold-webhook] processApprovedPayment result:', ok);
```
También eliminar los logs de diagnóstico dentro de `validateBoldSignature`:
```ts
console.log('[bold-webhook] signature recibida:', ...);
console.log('[bold-webhook] expected hex:', ...);
console.log('[bold-webhook] expected b64:', ...);
```

---

### PASO 6 — Verificación final en producción

1. Inicia sesión en la app con una cuenta real en `https://www.mibauldigital.com`
2. Ve a `/dashboard/pricing` y contrata el plan Premium mensual
3. Completa el pago real con PSE o tarjeta de crédito
4. Verifica en Vercel logs que:
   - `create-bold-link` retorna un `paymentUrl` sin errores
   - El webhook recibe `SALE_APPROVED` y `processApprovedPayment result: true`
5. Verifica en Supabase que la tabla `subscriptions` muestra `plan_type = 'premium'` y `is_active = true`
6. Verifica en la app que el dashboard muestra el plan Premium activo

---

## Resumen rápido (checklist)

```
[ ] 1. Obtener llaves de producción en panel Bold (modo producción)
[ ] 2. Actualizar BOLD_API_KEY y BOLD_SECRET_KEY en Vercel
[ ] 3. ELIMINAR la variable BOLD_SKIP_SIGNATURE de Vercel
[ ] 4. Esperar deploy de Vercel (~2 min)
[ ] 5. Registrar webhook de producción en Bold con la nueva llave
[ ] 6. Hacer un pago real de prueba y verificar logs
[ ] 7. Si firma falla: diagnosticar hex vs base64 en validateBoldSignature
[ ] 8. Limpiar console.log de diagnóstico en create-bold-link y webhooks/bold
[ ] 9. Hacer commit y push de la limpieza de logs
[ ] 10. Verificar plan actualizado en Supabase y en la app
```

---

## Archivos clave del sistema de pagos

| Archivo | Función |
|---------|---------|
| `src/app/api/payments/create-bold-link/route.ts` | Crea el link de pago en Bold y retorna la URL |
| `src/app/api/webhooks/bold/route.ts` | Recibe y procesa los eventos de Bold (SALE_APPROVED, etc.) |
| `src/services/paymentService.ts` | Llama al RPC `process_approved_payment` de Supabase |
| `supabase/migrations/046_fix_process_approved_payment.sql` | Función SQL que actualiza la suscripción del usuario |
| `.env.local` | Variables locales (desarrollo) — NO se despliegan a Vercel |

---

*Documento generado el 2026-04-24. Proyecto: Baúl Digital — www.mibauldigital.com*
