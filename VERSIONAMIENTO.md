# Metodología de Versionamiento — Baúl Digital

Documento de referencia completo sobre la estrategia de ramas, convención de commits y flujos de trabajo del proyecto. Aplica tanto para el desarrollador como para el agente IA que asiste en el desarrollo.

---

## Estrategia de ramas

El proyecto usa **dos ramas permanentes**:

| Rama | Propósito | Entorno Vercel | Quién accede |
|------|-----------|----------------|--------------|
| `main` | Código en producción, estable y probado | Deploy de producción (URL real) | Usuarios reales |
| `develop` | Trabajo activo, features y fixes en progreso | Preview Deployment (URL temporal) | Solo el desarrollador |

### Regla fundamental

> **Nunca se hace trabajo directo en `main`.** Todo cambio pasa primero por `develop`, se prueba en la Preview URL, y solo cuando está aprobado se integra a `main`.

La única excepción son los **hotfixes urgentes** que necesitan llegar a producción de inmediato (errores críticos que afectan a usuarios activos).

---

## Convención de commits

El prefijo del commit identifica en qué rama se origina el cambio:

### Commits en `develop` (trabajo habitual)

```
jolicastrog-develop-<tipo>: descripción breve
```

**Tipos válidos:**

| Tipo | Cuándo usarlo |
|------|--------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Documentación (.md, comentarios) |
| `style` | Cambios visuales/CSS sin lógica |
| `refactor` | Reorganización de código sin cambio de comportamiento |
| `test` | Pruebas |
| `chore` | Tareas de mantenimiento (deps, config) |

**Ejemplos:**
```
jolicastrog-develop-feat: agregar reproductor de audio en vista previa
jolicastrog-develop-fix: corregir validación de tamaño de archivo por plan
jolicastrog-develop-docs: actualizar GUIDE_CONTENT.md con sección de cancelación
jolicastrog-develop-style: ajustar colores del panel de onboarding
```

### Commit de integración en `main` (merge desde develop)

```
jolicastrog-main-merge: integrar develop → main
```

Opcionalmente se puede agregar una descripción del conjunto de cambios:
```
jolicastrog-main-merge: integrar develop → main · soporte audio/video y guía de usuario
```

### Hotfix directo en `main` (solo emergencias)

```
jolicastrog-main-fix: descripción del error crítico corregido
```

---

## Flujos de trabajo

### Flujo 1 — Nueva funcionalidad o mejora (caso más común)

```
1. Asegurarse de estar en develop
   git checkout develop
   git pull origin develop          ← traer últimos cambios si los hay

2. Hacer los cambios en el código

3. Commit en develop
   git add <archivos>
   git commit -m "jolicastrog-develop-feat: descripción"

4. Push a develop
   git push origin develop
   → Vercel genera automáticamente la Preview URL

5. Revisar en la Preview URL
   https://baul-digital-git-develop-jolicastrog.vercel.app
   (o similar — Vercel la muestra en el dashboard)

6. Si está aprobado → integrar a main
   git checkout main
   git pull origin main             ← asegurarse de tener main actualizado
   git merge develop
   git push origin main
   → Vercel despliega a producción automáticamente

7. Volver a develop para el siguiente trabajo
   git checkout develop
```

---

### Flujo 2 — Cambio con migración de base de datos

Las migraciones SQL son manuales en este proyecto (no se ejecutan automáticamente en cada push). Supabase es compartido entre `develop` y `main` (mismo proyecto, tier gratuito), por lo que la migración impacta la única BD existente.

```
1. Escribir el código en develop + el archivo SQL en supabase/migrations/
   git commit -m "jolicastrog-develop-feat: descripción del cambio"
   git push origin develop

2. Aplicar la migración SQL en Supabase Dashboard
   → supabase.com → proyecto → SQL Editor → pegar y ejecutar el SQL
   (se aplica una sola vez; afecta la BD compartida entre develop y main)

3. Probar en la Preview URL de develop
   La app en develop ya usa el nuevo esquema

4. Si está aprobado → integrar a main
   git checkout main
   git merge develop
   git push origin main
   → Producción despliega el código que ya funciona con el nuevo esquema

ORDEN CRÍTICO: migración SQL → prueba en develop → merge a main
No aplicar la migración después del merge, podría dejar main roto mientras
el código nuevo espera un esquema que aún no existe.
```

---

### Flujo 3 — Hotfix urgente en producción

Para errores críticos que afectan a usuarios activos y no pueden esperar el ciclo normal de develop → main.

```
1. Crear rama de hotfix desde main
   git checkout main
   git pull origin main
   git checkout -b hotfix/descripcion-breve

2. Corregir el error

3. Commit
   git commit -m "jolicastrog-main-fix: descripción del error corregido"

4. Merge directo a main
   git checkout main
   git merge hotfix/descripcion-breve
   git push origin main
   → Producción se actualiza inmediatamente

5. Llevar el fix también a develop para no perderlo
   git checkout develop
   git merge main
   git push origin develop

6. Eliminar rama de hotfix
   git branch -d hotfix/descripcion-breve
   git push origin --delete hotfix/descripcion-breve
```

---

### Flujo 4 — Múltiples commits en develop antes de integrar

No es obligatorio integrar a `main` después de cada commit. Se pueden acumular varios commits relacionados en `develop` y hacer un solo merge cuando el conjunto esté completo y probado.

```
develop: feat: pantalla de onboarding
develop: fix: error en validación de archivo
develop: docs: actualizar guía de usuario
develop: style: ajustar colores del banner
         ↓ (todos probados y aprobados)
main:    merge: integrar develop → main · onboarding + guía actualizada
```

Esto mantiene `main` con un historial limpio de puntos de integración, mientras `develop` tiene el detalle completo del trabajo.

---

## Entorno y servicios compartidos

Dado que el proyecto usa el **tier gratuito** de todos los servicios, existe un único entorno de infraestructura que comparten ambas ramas:

| Servicio | Plan | Detalle |
|----------|------|---------|
| Vercel | Hobby (gratis) | `main` → producción · `develop` → Preview URL automática |
| Supabase | Free | **Un solo proyecto** — BD compartida entre develop y main |
| Resend | Free (3.000 emails/mes) | Misma API key — emails de prueba consumen cuota real |
| Bold Pagos | — | Llaves TEST disponibles — sin cargo real en pruebas |

### Implicaciones prácticas

- **Datos de prueba en develop** van a la BD de producción. Limpiar registros de prueba si es necesario.
- **Emails disparados en develop** (crons, alertas de vencimiento) consumen el límite de Resend. Evitar disparar flujos masivos de email en la Preview.
- **Migraciones SQL** se aplican una sola vez directamente en Supabase — no hay BD separada de staging.
- **Archivos subidos en develop** ocupan cuota real del Storage de Supabase (1 GB en free).

---

## Comandos de referencia rápida

```bash
# Ver en qué rama estás
git branch

# Cambiar a develop
git checkout develop

# Cambiar a main
git checkout main

# Traer últimos cambios del remoto
git pull origin develop
git pull origin main

# Ver estado de los archivos modificados
git status

# Ver historial de commits
git log --oneline -10

# Ver diferencias entre develop y main
git log main..develop --oneline

# Hacer commit
git add src/ruta/archivo.tsx
git commit -m "jolicastrog-develop-feat: descripción"

# Push
git push origin develop
git push origin main

# Merge de develop a main
git checkout main
git merge develop
git push origin main

# Volver a develop después del merge
git checkout develop
```

---

## Estado actual del repositorio

- **Rama activa de trabajo:** `develop`
- **Repositorio remoto:** https://github.com/jolicastrog/baul_digital
- **URL de producción (main):** Vercel — conectada a `main`
- **URL de preview (develop):** Generada automáticamente por Vercel al hacer push a `develop`
- **Rama predeterminada en GitHub:** `main`

---

## Historial de commits anterior a esta metodología

Todos los commits anteriores a la creación de `develop` (hasta `29cf600`) fueron hechos directamente en `main` con el prefijo `jolicastrog-<tipo>:` sin distinción de rama. A partir de la creación de `develop` (commit posterior a `29cf600`) aplica la nueva convención con prefijo de rama.
