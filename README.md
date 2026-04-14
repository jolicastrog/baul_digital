# Baúl Digital 📁

Una aplicación web progresiva (PWA) para el almacenamiento y gestión digital de documentos personales en Ecuador. Diseñada para simplificar la organización de documentos importantes como cédulas, certificados, contratos y más.

## 🚀 Características Principales

- **📱 PWA (Progressive Web App)**: Funciona como aplicación nativa en móviles y desktop
- **🔐 Autenticación Segura**: Sistema de login basado en cédula ecuatoriana
- **📂 Gestión de Documentos**: Subida, organización y búsqueda de documentos
- **💾 Cuotas de Almacenamiento**: Control de espacio usado por usuario
- **📊 Dashboard Interactivo**: Visualización clara del estado de documentos
- **🔔 Alertas Inteligentes**: Notificaciones sobre documentos próximos a vencer
- **☁️ Sincronización**: Datos seguros en la nube con respaldo local

## 🛠️ Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI/UX**: Tailwind CSS, Radix UI, Lucide Icons
- **Base de Datos**: PostgreSQL (local) / Supabase (producción)
- **Autenticación**: Supabase Auth
- **Almacenamiento**: Supabase Storage
- **PWA**: Next-PWA
- **Estado**: Zustand
- **Validación**: Zod

## 📋 Prerrequisitos

- Node.js 18+ ([Descargar](https://nodejs.org))
- Docker y Docker Compose ([Descargar](https://www.docker.com))
- Git ([Descargar](https://git-scm.com))

## 🚀 Inicio Rápido - Desarrollo Local

### Opción 1: Setup Automático (Recomendado)

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd baul-digital

# Ejecutar setup automático
npm run setup
```

### Opción 2: Setup Manual

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.local.example .env.local

# 3. Iniciar servicios Docker (PostgreSQL + PgAdmin)
npm run docker:up

# 4. Esperar que PostgreSQL esté listo (~10 segundos)
# 5. Ejecutar migraciones y seeders
npm run db:fresh

# 6. Probar conexión
npm run db:test

# 7. Iniciar aplicación
npm run dev
```

## 📊 Servicios de Desarrollo Local

Después del setup, tendrás acceso a:

- **Aplicación**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **PgAdmin**: http://localhost:8080
  - Usuario: `admin@bauldigital.local`
  - Password: `admin123`

## 📝 Usuario de Prueba

- **Email**: test@bauldigital.local
- **Cédula**: 1234567890

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run build            # Construir para producción
npm run start            # Iniciar servidor de producción
npm run lint             # Ejecutar linter
npm run type-check       # Verificar tipos TypeScript

# Base de datos (local)
npm run db:migrate       # Ejecutar migraciones pendientes
npm run db:reset         # Resetear base de datos
npm run db:seed          # Ejecutar seeders
npm run db:fresh         # Reset + migrar + seed
npm run db:test          # Probar conexión

# Docker
npm run docker:up        # Iniciar servicios
npm run docker:down      # Detener servicios
npm run docker:logs      # Ver logs

# Utilidades
npm run format           # Formatear código
npm run setup            # Setup completo (primera vez)
```

## 📁 Estructura del Proyecto

```
baul-digital/
├── src/
│   ├── app/                 # Páginas Next.js (App Router)
│   ├── components/          # Componentes React reutilizables
│   ├── lib/                 # Utilidades y configuraciones
│   ├── hooks/               # Custom hooks
│   └── stores/              # Estado global (Zustand)
├── scripts/                 # Scripts de automatización
├── public/                  # Archivos estáticos
├── docker-compose.yml       # Configuración Docker local
├── .env.local.example       # Variables de entorno (ejemplo)
└── LOCAL_DEVELOPMENT.md     # Guía completa de desarrollo local
```

## 🔄 Migración a Producción

Cuando estés listo para producción:

1. **Configurar Supabase**:
   - Crear proyecto en [supabase.com](https://supabase.com)
   - Vincular el proyecto local: `npx supabase link --project-ref <ref>`
   - Aplicar todas las migraciones: `npx supabase db push`
     - `001_init_schema.sql` — Tablas, RLS, triggers
     - `002_storage_buckets.sql` — Buckets de Storage
     - `003_document_limit.sql` — Límites de documentos por plan

2. **Variables de Entorno**:
   - Copiar `.env.local` a `.env.production`
   - Actualizar credenciales de Supabase
   - Configurar variables de producción

3. **Desplegar**:
   - Configurar variables en Vercel/Netlify
   - Ejecutar `npm run build`
   - Desplegar automáticamente

## 📚 Documentación Adicional

- **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)**: Guía completa de desarrollo local
- **[Arquitectura](docs/architecture.md)**: Documentación técnica
- **[API](docs/api.md)**: Referencia de endpoints
- **[Despliegue](docs/deployment.md)**: Guías de producción

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 👥 Equipo

- **Desarrollador Principal**: José Lizardo
- **Diseño UX/UI**: Equipo Baúl Digital
- **Arquitectura**: José Lizardo

---

**Baúl Digital** - Simplificando la gestión documental en Ecuador 🇪🇨
