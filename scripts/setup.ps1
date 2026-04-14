# Script de inicialización rápida para desarrollo local
# Uso: ./scripts/setup.sh (en Linux/Mac) o scripts\setup.ps1 (en Windows)

Write-Host "🚀 Iniciando setup de Baúl Digital - Desarrollo Local" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Verificar prerrequisitos
Write-Host "📋 Verificando prerrequisitos..." -ForegroundColor Yellow

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js no está instalado. Instálalo desde https://nodejs.org" -ForegroundColor Red
    exit 1
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker no está instalado. Instálalo desde https://www.docker.com" -ForegroundColor Red
    exit 1
}

if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker Compose no está instalado." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerrequisitos verificados" -ForegroundColor Green

# Instalar dependencias
Write-Host "📦 Instalando dependencias de Node.js..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencias instaladas" -ForegroundColor Green

# Configurar variables de entorno
Write-Host "⚙️  Configurando variables de entorno..." -ForegroundColor Yellow
if (!(Test-Path .env.local)) {
    Copy-Item .env.local.example .env.local
    Write-Host "✅ Archivo .env.local creado" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Archivo .env.local ya existe" -ForegroundColor Blue
}

# Iniciar servicios Docker
Write-Host "🐳 Iniciando PostgreSQL y PgAdmin..." -ForegroundColor Yellow
npm run docker:up

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error iniciando servicios Docker" -ForegroundColor Red
    exit 1
}

Write-Host "⏳ Esperando que PostgreSQL esté listo..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Ejecutar migraciones
Write-Host "🗄️  Ejecutando migraciones de base de datos..." -ForegroundColor Yellow
npm run db:fresh

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error ejecutando migraciones" -ForegroundColor Red
    exit 1
}

# Probar conexión
Write-Host "🔍 Probando conexión a la base de datos..." -ForegroundColor Yellow
npm run db:test

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error de conexión a la base de datos" -ForegroundColor Red
    exit 1
}

Write-Host "" -ForegroundColor White
Write-Host "🎉 ¡Setup completado exitosamente!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "📊 Servicios disponibles:" -ForegroundColor Cyan
Write-Host "  • PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "  • PgAdmin: http://localhost:8080" -ForegroundColor White
Write-Host "    - Usuario: admin@bauldigital.local" -ForegroundColor White
Write-Host "    - Password: admin123" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "🚀 Para iniciar la aplicación:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "📝 Usuario de prueba:" -ForegroundColor Cyan
Write-Host "  • Email: test@bauldigital.local" -ForegroundColor White
Write-Host "  • Cédula: 1234567890" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "📚 Para más información, lee LOCAL_DEVELOPMENT.md" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "¡Feliz desarrollo! 🎊" -ForegroundColor Magenta