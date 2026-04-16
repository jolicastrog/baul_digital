/**
 * Generador de íconos PWA para Baúl Digital
 * Usa sharp (incluido en Next.js) para crear íconos PNG desde SVG
 *
 * Ejecutar con: npm run generate-icons
 */

const path = require('path');
const fs   = require('fs');

// sharp está disponible internamente en Next.js
let sharp;
try {
  sharp = require('sharp');
} catch {
  try {
    sharp = require(path.join(process.cwd(), 'node_modules', 'sharp'));
  } catch {
    console.error('❌ sharp no encontrado. Instalándolo...');
    console.log('   Ejecuta: npm install sharp --save-dev');
    console.log('   Luego vuelve a correr: npm run generate-icons');
    process.exit(1);
  }
}

// SVG del ícono de Baúl Digital
// Diseño: fondo azul oscuro, candado estilizado + letras BD
const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Fondo -->
  <rect width="512" height="512" rx="100" fill="#1e40af"/>

  <!-- Cuerpo del candado -->
  <rect x="156" y="248" width="200" height="160" rx="20" fill="#ffffff"/>

  <!-- Arco del candado -->
  <path
    d="M196 248 V190 A60 60 0 0 1 316 190 V248"
    fill="none"
    stroke="#ffffff"
    stroke-width="36"
    stroke-linecap="round"
  />

  <!-- Agujero del candado -->
  <circle cx="256" cy="318" r="22" fill="#1e40af"/>

  <!-- Línea del agujero -->
  <rect x="244" y="316" width="24" height="30" rx="6" fill="#1e40af"/>

  <!-- Letras BD pequeñas debajo -->
  <text
    x="256"
    y="458"
    font-family="Arial, sans-serif"
    font-size="64"
    font-weight="bold"
    fill="rgba(255,255,255,0.35)"
    text-anchor="middle"
    dominant-baseline="middle"
  >BD</text>
</svg>
`.trim();

const SIZES   = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

async function generateIcons() {
  // Crear carpeta si no existe
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log('📁 Carpeta public/icons/ creada');
  }

  const svgBuffer = Buffer.from(ICON_SVG);

  console.log('🎨 Generando íconos PWA...\n');

  for (const size of SIZES) {
    const outputPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  ✅ icon-${size}x${size}.png`);
  }

  // Generar también favicon.ico (usando el de 32px)
  const faviconPath = path.join(process.cwd(), 'public', 'favicon.ico');
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconPath.replace('.ico', '.png'));

  // Renombrar a favicon.png (los navegadores modernos aceptan PNG como favicon)
  const faviconPng = faviconPath.replace('.ico', '.png');
  if (fs.existsSync(faviconPng)) {
    console.log(`  ✅ favicon.png (32x32)`);
  }

  console.log('\n🚀 ¡Listo! Íconos generados en public/icons/');
  console.log('   Ya puedes correr: npm run dev');
}

generateIcons().catch(err => {
  console.error('❌ Error generando íconos:', err.message);
  process.exit(1);
});
