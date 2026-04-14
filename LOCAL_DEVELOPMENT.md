# 🏠 Desarrollo Local - Baúl Digital

Esta guía explica cómo ejecutar Baúl Digital en tu máquina local usando PostgreSQL en lugar de Supabase inicialmente.

## 📋 Prerrequisitos

### 1. Node.js
```bash
node --version  # Debe ser 18+
npm --version   # Debe ser 8+
```

### 2. Docker & Docker Compose
```bash
docker --version
docker-compose --version
```

Si no tienes Docker instalado:
- Descarga desde: https://www.docker.com/get-started

### 3. Git
```bash
git --version
```

---

## 🚀 Setup Rápido (5 minutos)

### Paso 1: Clonar e instalar dependencias
```bash
git clone <tu-repo>
cd baulDigital
npm install
```

### Paso 2: Configurar variables de entorno
```bash
cp .env.local.example .env.local
```

El archivo `.env.local` ya tiene la configuración correcta para desarrollo local.

### Paso 3: Iniciar PostgreSQL con Docker
```bash
# Iniciar PostgreSQL y PgAdmin
npm run docker:up

# Verificar que esté corriendo
docker ps
```

**Acceder a PgAdmin:**
- URL: http://localhost:8080
- Email: admin@bauldigital.local
- Password: admin123

### Paso 4: Crear base de datos y tablas
```bash
# Crear tablas, funciones y políticas
npm run db:migrate

# Insertar datos de prueba (opcional)
npm run db:seed
```

### Paso 5: Ejecutar la aplicación
```bash
npm run dev
```

**¡Listo!** Accede a http://localhost:3000

---

## 📊 Servicios Locales

Después de `npm run docker:up`, tendrás:

| Servicio | URL | Usuario | Contraseña |
|----------|-----|---------|------------|
| **PostgreSQL** | localhost:5432 | postgres | postgres123 |
| **PgAdmin** | http://localhost:8080 | admin@bauldigital.local | admin123 |
| **Next.js App** | http://localhost:3000 | - | - |

---

## 🛠️ Comandos Útiles

### Base de Datos
```bash
# Ejecutar migraciones
npm run db:migrate

# Resetear base de datos completamente
npm run db:fresh

# Solo insertar datos de prueba
npm run db:seed

# Resetear sin datos
npm run db:reset
```

### Docker
```bash
# Ver logs de PostgreSQL
npm run docker:logs

# Detener servicios
npm run docker:down

# Reiniciar servicios
npm run docker:down && npm run docker:up
```

### Desarrollo
```bash
# Ejecutar con hot reload
npm run dev

# Verificar tipos TypeScript
npm run type-check

# Formatear código
npm run format

# Ejecutar linter
npm run lint
```

---

## � Esquema de Base de Datos Local

El esquema local (`scripts/init_local_schema.sql`) es una adaptación del esquema de Supabase para PostgreSQL estándar:

### 🔄 Diferencias con Supabase

| Aspecto | Supabase | PostgreSQL Local |
|---------|----------|------------------|
| **IDs** | `public.uid()` | `uuid_generate_v4()` |
| **RLS** | Políticas complejas | Sin RLS (desarrollo) |
| **Auth** | Supabase Auth | Sin autenticación |
| **Funciones** | Funciones específicas | Funciones estándar |
| **Datos** | Sin datos de prueba | Datos de prueba incluidos |

### 🗂️ Tablas Incluidas

- **`profiles`** - Usuarios y metadatos
- **`categories`** - Categorías de documentos
- **`documents`** - Documentos del usuario
- **`subscriptions`** - Planes y pagos
- **`alerts`** - Alertas de vencimiento
- **`payment_webhooks`** - Registros de pagos
- **`fraud_detection`** - Detección de fraude
- **`audit_logs`** - Logs de auditoría

### 👤 Datos de Prueba

El esquema incluye automáticamente:
- **Usuario**: test@bauldigital.local (cédula: 1234567890)
- **Categorías**: Identificación, Financieros, Salud, Educación, Laboral
- **Documentos**: Cédula y contrato de ejemplo

---

## �🔍 Verificar Instalación

### 1. Conectar a PostgreSQL
```bash
# Desde terminal
psql -h localhost -p 5432 -U postgres -d baul_digital
# Password: postgres123

# Ver tablas creadas
\dt

# Ver funciones
\df
```

### 2. Ver datos de prueba
```sql
-- Ver usuarios
SELECT id, email, cedula_unica, plan_type FROM profiles;

-- Ver categorías
SELECT name, color_code FROM categories;

-- Ver funciones disponibles
SELECT proname FROM pg_proc WHERE proname LIKE 'check_%' OR proname LIKE 'update_%';
```

### 3. Probar API (desde otra terminal)
```bash
# Health check (crear endpoint de prueba)
curl http://localhost:3000/api/health
```

---

## 🐛 Solución de Problemas

### PostgreSQL no inicia
```bash
# Ver logs
npm run docker:logs

# Reiniciar
npm run docker:down
npm run docker:up
```

### Error de conexión
```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres

# Verificar puerto
netstat -an | findstr 5432
```

### Migración falla
```bash
# Resetear y migrar de nuevo
npm run db:fresh
```

### Puerto ocupado
Si el puerto 5432 está ocupado:
```bash
# Cambiar puerto en docker-compose.yml
ports:
  - "5433:5432"  # Cambiar a 5433

# Actualizar .env.local
DB_PORT=5433
```

---

## 🔄 Migrar a Supabase (Producción)

Cuando estés listo para producción:

### 1. Crear proyecto en Supabase
- Ir a https://supabase.com
- Crear nuevo proyecto
- Copiar URL y keys

### 2. Actualizar variables de entorno
```bash
# En .env.local cambiar:
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Cambiar storage type
NEXT_PUBLIC_STORAGE_TYPE=supabase
```

### 3. Ejecutar migraciones en Supabase
```bash
# Usar Supabase CLI
npm run db:push
```

### 4. Configurar Edge Functions
```bash
# Desplegar función de alertas
supabase functions deploy send-alert-notifications
```

---

## 📁 Estructura de Archivos

```
baulDigital/
├── docker-compose.yml          # PostgreSQL + PgAdmin
├── scripts/
│   └── migrate.js              # Script de migraciones locales
├── supabase/migrations/        # SQL para Supabase/producción
├── .env.local.example          # Variables para desarrollo
└── src/                        # Código de la aplicación
```

---

## 🎯 Próximos Pasos

1. **Implementar autenticación** (login/register)
2. **Crear dashboard** (listar documentos)
3. **Integrar FileUpload** component
4. **Implementar categorías** y filtros
5. **Crear sistema de alertas**

---

## 💡 Tips de Desarrollo

- **Usa PgAdmin** para explorar la BD visualmente
- **Los datos de prueba** incluyen usuario: `test@bauldigital.local`
- **Las migraciones** son reversibles con `npm run db:reset`
- **El hot reload** funciona para cambios en código
- **TypeScript** te ayudará a detectar errores temprano

---

**¡Feliz desarrollo! 🚀**

*Baúl Digital - Gestión inteligente de documentos*
