// ── pdfBrand.js — membrete profesional unificado para todos los PDFs ────────
// Uso: import { drawHeader, drawFooter, drawPageHeader, hex2rgb } from '../../lib/pdfBrand'
// drawHeader devuelve el Y desde donde empieza el contenido (~68mm)

const W = 210 // ancho A4 mm

export function hex2rgb(hex = '#16a34a') {
  const h = hex.replace('#', '').padEnd(6, '0')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function lighten([r,g,b], f = 0.87) {
  return [Math.round(r+(255-r)*f), Math.round(g+(255-g)*f), Math.round(b+(255-b)*f)]
}

function initials(nombre = '') {
  return nombre.trim().split(/\s+/).slice(0,2).map(w => w[0] || '').join('').toUpperCase() || 'SP'
}

// ── Header principal (primera página) ───────────────────────────────────────
// Retorna el Y desde donde empieza el contenido
export function drawHeader(doc, { tenant, titulo, subtitulo = '', periodo = '' }) {
  const col    = tenant?.color_primario || '#16a34a'
  const [r,g,b]  = hex2rgb(col)
  const [rl,gl,bl] = lighten([r,g,b], 0.88)
  const nombre  = tenant?.nombre  || 'Salón Pro'
  const tel     = tenant?.telefono || ''
  const ciudad  = tenant?.ciudad   || ''
  const ig      = tenant?.instagram ? `@${tenant.instagram.replace('@','')}` : ''
  const web     = tenant?.pagina_web || ''
  const fecha   = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })

  // ── 1. Barra superior oscura (10mm) ─────────────────────────────────────
  doc.setFillColor(18, 18, 18)
  doc.rect(0, 0, W, 10, 'F')

  // Nombre salón (izq, gris claro)
  doc.setFontSize(6.5); doc.setFont('helvetica','normal')
  doc.setTextColor(180,180,180)
  doc.text(nombre.toUpperCase(), 10, 6.5)

  // "SALÓN PRO" (der, blanco)
  doc.setFont('helvetica','bold')
  doc.setTextColor(255,255,255)
  doc.text('SALÓN PRO  ·  Sistema de gestión profesional', W - 10, 6.5, { align:'right' })

  // ── 2. Área blanca con info del negocio (10–43mm) ───────────────────────
  doc.setFillColor(255,255,255)
  doc.rect(0, 10, W, 33, 'F')

  // Acento vertical izquierdo
  doc.setFillColor(r,g,b)
  doc.rect(0, 10, 5, 33, 'F')

  // Avatar con iniciales
  doc.setFillColor(rl,gl,bl)
  doc.roundedRect(10, 14, 22, 22, 4, 4, 'F')
  const ini = initials(nombre)
  doc.setTextColor(r,g,b)
  doc.setFontSize(ini.length > 1 ? 9 : 13)
  doc.setFont('helvetica','bold')
  doc.text(ini, 21, 27.5, { align:'center' })

  // Nombre del negocio
  doc.setTextColor(18,18,18)
  doc.setFontSize(15); doc.setFont('helvetica','bold')
  doc.text(nombre, 37, 22)

  // Línea de contacto 1
  const c1 = [ciudad && `${ciudad}`, tel && `Tel: ${tel}`].filter(Boolean).join('   ·   ')
  doc.setFontSize(7.5); doc.setFont('helvetica','normal')
  doc.setTextColor(90,90,90)
  if (c1) doc.text(c1, 37, 29)

  // Línea de contacto 2
  const c2 = [ig, web].filter(Boolean).join('   ·   ')
  doc.setFontSize(7); doc.setTextColor(130,130,130)
  if (c2) doc.text(c2, 37, 35)

  // Chip "DOCUMENTO OFICIAL" derecha
  doc.setFillColor(rl,gl,bl)
  doc.roundedRect(W-52, 15, 46, 8, 2, 2, 'F')
  doc.setFontSize(6); doc.setFont('helvetica','bold')
  doc.setTextColor(r,g,b)
  doc.text('DOCUMENTO OFICIAL', W-29, 20, { align:'center' })

  // ── 3. Línea separadora color ────────────────────────────────────────────
  doc.setFillColor(r,g,b)
  doc.rect(0, 43, W, 1, 'F')

  // ── 4. Banda título del informe (43–64mm) ────────────────────────────────
  doc.setFillColor(rl,gl,bl)
  doc.rect(0, 44, W, 20, 'F')

  doc.setTextColor(r,g,b)
  doc.setFontSize(15); doc.setFont('helvetica','bold')
  doc.text(titulo.toUpperCase(), W/2, 54, { align:'center' })

  const det = [subtitulo, periodo, `Generado: ${fecha}`].filter(Boolean).join('   ·   ')
  doc.setFontSize(7.5); doc.setFont('helvetica','normal')
  doc.setTextColor(70,70,70)
  doc.text(det, W/2, 61, { align:'center' })

  // Línea inferior header
  doc.setFillColor(r,g,b)
  doc.rect(0, 64, W, 0.7, 'F')

  doc.setTextColor(0,0,0)
  return 72 // Y inicio del contenido
}

// ── Header compacto para páginas de continuación ─────────────────────────────
export function drawPageHeader(doc, { tenant, titulo, pagina }) {
  const col     = tenant?.color_primario || '#16a34a'
  const [r,g,b] = hex2rgb(col)
  const nombre  = tenant?.nombre || 'Salón Pro'

  doc.setFillColor(18,18,18)
  doc.rect(0, 0, W, 8, 'F')
  doc.setFontSize(6); doc.setFont('helvetica','normal')
  doc.setTextColor(180,180,180)
  doc.text(`${nombre.toUpperCase()}  ·  ${titulo.toUpperCase()}`, 10, 5.5)
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold')
  doc.text(`Página ${pagina}`, W-10, 5.5, { align:'right' })

  doc.setFillColor(r,g,b)
  doc.rect(0, 8, W, 0.6, 'F')

  doc.setTextColor(0,0,0)
  return 16 // Y inicio del contenido en página de continuación
}

// ── Footer de página ──────────────────────────────────────────────────────────
export function drawFooter(doc, { tenant, titulo, pagina = 1 }) {
  const col     = tenant?.color_primario || '#16a34a'
  const [r,g,b] = hex2rgb(col)
  const nombre  = tenant?.nombre || ''
  const fecha   = new Date().toLocaleDateString('es-CO')

  doc.setFillColor(r,g,b)
  doc.rect(0, 281, W, 0.5, 'F')

  doc.setFontSize(6.5); doc.setFont('helvetica','normal')
  doc.setTextColor(150,150,150)
  doc.text(`Página ${pagina}`, 10, 287)
  doc.text(`${nombre}  ·  ${titulo}`, W/2, 287, { align:'center' })
  doc.text('Salón Pro · salonpro.app', W-10, 287, { align:'right' })
}

// ── Tabla de encabezado (fila de columnas) ───────────────────────────────────
export function drawTableHeader(doc, { tenant, columnas, xList, y, rowH = 8 }) {
  const col     = tenant?.color_primario || '#16a34a'
  const [r,g,b] = hex2rgb(col)
  doc.setFillColor(r,g,b)
  doc.rect(10, y, W-20, rowH, 'F')
  doc.setTextColor(255,255,255)
  doc.setFontSize(7.5); doc.setFont('helvetica','bold')
  columnas.forEach((txt, i) => {
    const align = i === columnas.length-1 ? 'right' : 'left'
    const x = align === 'right' ? xList[i]+2 : xList[i]+2
    doc.text(txt, x, y + rowH-1.5, { align })
  })
  return y + rowH + 2
}

// ── Fila alternada de tabla ───────────────────────────────────────────────────
export function drawTableRow(doc, { idx, y, rowH = 7 }) {
  if (idx % 2 === 0) {
    doc.setFillColor(248,249,250)
    doc.rect(10, y-4, W-20, rowH, 'F')
  }
}

// ── Caja KPI 2×2 ─────────────────────────────────────────────────────────────
export function drawKPIBox(doc, { tenant, label, valor, x, y, w = 88, h = 22 }) {
  const col     = tenant?.color_primario || '#16a34a'
  const [r,g,b] = hex2rgb(col)
  const [rl,gl,bl] = lighten([r,g,b], 0.88)

  doc.setFillColor(rl,gl,bl)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')
  doc.setFillColor(r,g,b)
  doc.roundedRect(x, y, 4, h, 2, 2, 'F')

  doc.setFontSize(7); doc.setFont('helvetica','bold')
  doc.setTextColor(r,g,b)
  doc.text(label.toUpperCase(), x+8, y+7)

  doc.setFontSize(13); doc.setFont('helvetica','bold')
  doc.setTextColor(18,18,18)
  doc.text(String(valor), x+8, y+17)
}
