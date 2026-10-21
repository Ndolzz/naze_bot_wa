// Serializer XML Alight Motion NAZE untuk fitur Vector.
// Diadaptasi dari repositori Ndolzz/nazevector (js/modules/amAdapter.js,
// versi 0.5.1) dengan struktur keluaran yang dipertahankan identik: dokumen
// scene XML Alight Motion dari VectorPathData (keluaran mesin vektorisasi).
// Bot hanya memakai representasi "isi" dan "garis"; representasi "kontur"
// dipertahankan dari sumber agar port tetap setia pada implementasi aslinya.
// Modul ini murni: tanpa DOM, tanpa dependensi eksternal.
//
// Bukti format dari sumber: parser asli Alight Motion 5.0.273 hanya membaca
// outline shape imported dari tag <path> dengan atribut d; serializer asli
// menulis outline non-keyed langsung di bawah <shape>. Mode isi menulis satu
// <shape> per komponen (kontur luar + lubangnya), mode garis menulis satu
// <shape> per goresan centerline dengan <path-stroke> berisi tebal garis
// (pola shape "Bentuk 1" pada ekspor asli Alight Motion). Keluaran berupa
// bentuk statis tanpa keyframe.

export const AM_ADAPTER_STATUS = {
  id: 'AM',
  label: 'Adapter XML Alight Motion',
  reason:
    'Menghasilkan XML scene berisi layer shape statis per komponen, per goresan, atau per kontur (tanpa keyframe). Outline memakai tag path sesuai parser asli Alight Motion; tampilan pada perangkat nyata terbukti untuk mode isi (uji lapangan pada sumber). Mode garis (path-stroke) dan mode kontur menunggu uji lapangan.',
};

const SCENE_DEFAULTS = {
  title: 'Naze Vector Silhouette',
  totalTime: 5000,
  fps: '30',
  amver: '1028425',
  ffver: '106',
  am: 'com.alightcreative.motion/5.0.273.1028425',
  amplatform: 'android',
};

// Prolog ditulis oleh setiap ekspor asli Alight Motion yang diperiksa.
const XML_PROLOG = '<?xml version=\'1.0\' encoding=\'UTF-8\' ?>';

// buildAlightMotionXml(vectorPathData, options) -> string XML scene.
// options (semua opsional, untuk determinisme pengujian):
//   { title, totalTime (ms), fps, modifiedTime (ms epoch), color (#RRGGBB),
//     representation ('isi'|'garis'|'kontur'), centerlineData (wajib untuk
//     'garis'), componentColors, contourColors }
export function buildAlightMotionXml(vectorPathData, options = {}) {
  const { width, height, subpaths } = validateVectorData(vectorPathData);
  const title = resolveTitle(options.title);
  const totalTime = resolvePositiveInt(
    options.totalTime !== undefined ? options.totalTime : SCENE_DEFAULTS.totalTime,
    'totalTime'
  );
  const fps = resolveFps(options.fps !== undefined ? options.fps : SCENE_DEFAULTS.fps);
  const modifiedTime = resolveNonNegativeInt(
    options.modifiedTime !== undefined ? options.modifiedTime : Date.now(),
    'modifiedTime'
  );
  const globalColor = resolveFillColor(options.color);
  const representation = resolveRepresentation(options.representation);
  const components = groupSubpathsByComponent(subpaths);
  const componentColors = resolveComponentColors(options.componentColors, components.length);
  const contourColors = resolveContourColors(options.contourColors, subpaths.length);

  let shapes = '';
  if (representation === 'garis') {
    shapes = buildCenterlineShapes(options.centerlineData, {
      totalTime,
      globalColor,
      componentColors,
    });
  } else if (representation === 'kontur') {
    shapes = buildPerContourShapes(subpaths, {
      totalTime,
      globalColor,
      contourColors,
    });
  } else {
    shapes = buildFilledShapes(components, {
      totalTime,
      globalColor,
      componentColors,
    });
  }

  return (
    XML_PROLOG +
    '<scene title="' +
    escapeXml(title) +
    '" width="' +
    width +
    '" height="' +
    height +
    '" exportWidth="' +
    width +
    '" exportHeight="' +
    height +
    '" precompose="dynamicResolution" bgcolor="#00000000" totalTime="' +
    totalTime +
    '" fps="' +
    escapeXml(fps) +
    '" modifiedTime="' +
    modifiedTime +
    '" amver="' +
    SCENE_DEFAULTS.amver +
    '" ffver="' +
    SCENE_DEFAULTS.ffver +
    '" am="' +
    SCENE_DEFAULTS.am +
    '" amplatform="' +
    SCENE_DEFAULTS.amplatform +
    '" retime="freeze" retimeAdaptFPS="false">' +
    shapes +
    '</scene>'
  );
}

function buildFilledShapes(components, settings) {
  let shapes = '';
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const id = index + 1;
    const box = ringBbox(component.outer.points);
    const pivotX = (box.minX + box.maxX) / 2;
    const pivotY = (box.minY + box.maxY) / 2;
    const outline = [component.outer]
      .concat(component.holes)
      .map((subpath) => pathD(subpath.points, pivotX, pivotY))
      .join('');
    const fillColor = componentColorAt(settings, index);
    shapes +=
      '<shape id="' +
      id +
      '" label="Shape ' +
      id +
      '" startTime="0" endTime="' +
      settings.totalTime +
      '" fillType="color" mediaFillMode="fill">' +
      '<transform>' +
      '<location value="' +
      formatNumber(pivotX) +
      ',' +
      formatNumber(pivotY) +
      ',0.000000"/>' +
      '</transform>' +
      '<fillColor value="' +
      fillColor +
      '"/>' +
      '<path d="' +
      outline +
      '"/>' +
      '</shape>';
  }
  return shapes;
}

// Mode garis: satu shape (layer) per garis centerline. Path TIDAK ditutup Z
// dan mengulang titik awal sebagai L terakhir — pola path stroke ekspor asli
// Alight Motion; tebal garis pada <path-stroke> dari lebar pita hasil
// ekstraksi centerline.
function buildCenterlineShapes(centerlineData, settings) {
  if (!centerlineData || !Array.isArray(centerlineData.lines)) {
    throw new Error('Data garis tidak tersedia: mode garis memerlukan hasil ekstraksi centerline.');
  }
  if (centerlineData.lines.length === 0) {
    throw new Error('Data garis tidak tersedia: tidak ada garis yang diekstraksi.');
  }
  let shapes = '';
  for (let index = 0; index < centerlineData.lines.length; index += 1) {
    const line = validateCenterline(centerlineData.lines[index], index);
    const id = index + 1;
    const box = ringBbox(line.points);
    const pivotX = (box.minX + box.maxX) / 2;
    const pivotY = (box.minY + box.maxY) / 2;
    const fillColor = componentColorAt(settings, line.componentIndex);
    shapes +=
      '<shape id="' +
      id +
      '" label="Shape ' +
      id +
      '" startTime="0" endTime="' +
      settings.totalTime +
      '" fillType="color" mediaFillMode="fill">' +
      '<transform>' +
      '<location value="' +
      formatNumber(pivotX) +
      ',' +
      formatNumber(pivotY) +
      ',0.000000"/>' +
      '</transform>' +
      '<fillColor value="' +
      fillColor +
      '"/>' +
      '<path-stroke direction="centered" end-size="1.500000"><size value="' +
      formatNumber(line.width) +
      '"/></path-stroke>' +
      '<path d="' +
      polylineD(line.points, pivotX, pivotY) +
      '"/>' +
      '</shape>';
  }
  return shapes;
}

// Mode kontur: satu shape (layer) per subpath — kontur luar maupun lubang
// menjadi layer tersendiri (1 layer = 1 kontur). Urutan layer mengikuti
// urutan subpaths: kontur luar, lalu lubangnya, lalu pulau — lubang dan pulau
// berada setelah kontur luarnya pada daftar layer (asumsi urutan tumpukan;
// belum diverifikasi pada perangkat nyata).
function buildPerContourShapes(subpaths, settings) {
  let shapes = '';
  for (let index = 0; index < subpaths.length; index += 1) {
    const subpath = subpaths[index];
    const id = index + 1;
    const box = ringBbox(subpath.points);
    const pivotX = (box.minX + box.maxX) / 2;
    const pivotY = (box.minY + box.maxY) / 2;
    const fillColor = settings.contourColors
      ? settings.contourColors[index]
      : settings.globalColor;
    shapes +=
      '<shape id="' +
      id +
      '" label="Shape ' +
      id +
      '" startTime="0" endTime="' +
      settings.totalTime +
      '" fillType="color" mediaFillMode="fill">' +
      '<transform>' +
      '<location value="' +
      formatNumber(pivotX) +
      ',' +
      formatNumber(pivotY) +
      ',0.000000"/>' +
      '</transform>' +
      '<fillColor value="' +
      fillColor +
      '"/>' +
      '<path d="' +
      pathD(subpath.points, pivotX, pivotY) +
      '"/>' +
      '</shape>';
  }
  return shapes;
}

function validateCenterline(line, index) {
  if (
    !line ||
    !Array.isArray(line.points) ||
    line.points.length < 2 ||
    !line.points.every(
      (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
    )
  ) {
    throw new Error('Data garis tidak valid pada garis ke-' + (index + 1) + ': titik tidak lengkap.');
  }
  if (!Number.isFinite(line.width) || line.width <= 0) {
    throw new Error('Data garis tidak valid pada garis ke-' + (index + 1) + ': lebar garis tidak valid.');
  }
  if (!Number.isInteger(line.componentIndex) || line.componentIndex < 0) {
    throw new Error('Data garis tidak valid pada garis ke-' + (index + 1) + ': indeks komponen tidak valid.');
  }
  return line;
}

function componentColorAt(settings, componentIndex) {
  if (settings.componentColors && componentIndex < settings.componentColors.length) {
    return settings.componentColors[componentIndex];
  }
  return settings.globalColor;
}

function resolveRepresentation(value) {
  if (value === undefined || value === null) return 'isi';
  if (value !== 'isi' && value !== 'garis' && value !== 'kontur') {
    throw new Error('Opsi representation tidak valid: harus "isi", "garis", atau "kontur".');
  }
  return value;
}

function resolveComponentColors(value, componentCount) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length !== componentCount) {
    throw new Error(
      'Opsi componentColors tidak valid: panjang daftar warna (' +
        (Array.isArray(value) ? value.length : 'bukan array') +
        ') harus sama dengan jumlah komponen (' + componentCount + ').'
    );
  }
  return value.map((color) => resolveFillColor(color));
}

function resolveContourColors(value, contourCount) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length !== contourCount) {
    throw new Error(
      'Opsi contourColors tidak valid: panjang daftar warna (' +
        (Array.isArray(value) ? value.length : 'bukan array') +
        ') harus sama dengan jumlah kontur (' + contourCount + ').'
    );
  }
  return value.map((color) => resolveFillColor(color));
}

/* ---------- Validasi dan resolusi input ---------- */

function validateVectorData(vectorPathData) {
  if (!vectorPathData || typeof vectorPathData !== 'object') {
    throw new Error('Data vektor tidak valid: hasil vektorisasi belum tersedia.');
  }
  const width = vectorPathData.width;
  const height = vectorPathData.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Data vektor tidak valid: dimensi mask harus bilangan bulat positif.');
  }
  if (!Array.isArray(vectorPathData.subpaths) || vectorPathData.subpaths.length === 0) {
    throw new Error('Data vektor tidak valid: tidak ada kontur siluet untuk diekspor.');
  }
  for (const subpath of vectorPathData.subpaths) {
    if (
      !subpath ||
      !Array.isArray(subpath.points) ||
      subpath.points.length < 4 ||
      !subpath.points.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    ) {
      throw new Error('Data vektor tidak valid: kontur siluet tidak lengkap.');
    }
  }
  return { width, height, subpaths: vectorPathData.subpaths };
}

function resolveTitle(title) {
  if (title === undefined || title === null) return SCENE_DEFAULTS.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Judul scene tidak valid: harus berupa teks tak kosong.');
  }
  return title.trim().slice(0, 80);
}

function resolvePositiveInt(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Opsi ' + label + ' tidak valid: harus bilangan bulat positif.');
  }
  return value;
}

function resolveNonNegativeInt(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Opsi ' + label + ' tidak valid: harus bilangan bulat >= 0.');
  }
  return value;
}

function resolveFps(fps) {
  const value = typeof fps === 'number' ? String(fps) : fps;
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) {
    throw new Error('Opsi fps tidak valid: harus angka positif, misalnya "30".');
  }
  return value;
}

function resolveFillColor(colorHex) {
  if (colorHex === undefined || colorHex === null) return '#FF3B82F6';
  if (typeof colorHex !== 'string') {
    throw new Error('Warna siluet tidak valid untuk ekspor.');
  }
  const match = colorHex.match(/^#?([0-9A-Fa-f]{6})$/);
  if (!match) {
    throw new Error('Warna siluet tidak valid untuk ekspor: gunakan format #RRGGBB.');
  }
  return '#FF' + match[1].toUpperCase();
}

/* ---------- Pengelompokan komponen ---------- */

// Satu komponen siluet = satu kontur luar beserta seluruh lubang yang berada
// di dalamnya; menjadi satu <shape> (satu layer Alight Motion). Urutan
// komponen mengikuti urutan kontur luar pada subpaths (urutan pindai mesin
// vektorisasi, atas ke bawah) agar keluaran deterministik.
function groupSubpathsByComponent(subpaths) {
  const outers = subpaths.filter((subpath) => subpath.role === 'outer');
  if (outers.length === 0) {
    throw new Error('Data vektor tidak valid: tidak ada kontur luar siluet untuk diekspor.');
  }
  const components = outers.map((outer) => ({ outer, holes: [] }));
  for (const subpath of subpaths) {
    if (subpath.role !== 'hole') continue;
    const host = findHostOuter(subpath, outers);
    components[outers.indexOf(host)].holes.push(subpath);
  }
  return components;
}

// Lubang dimiliki kontur luar terkecil yang memuat titik representatifnya
// (titik pertama kontur lubang). Fallback pertahanan bila penyederhanaan RDP
// menggeser titik keluar dari kontur: kontainmen bbox. Bila keduanya gagal,
// kesalahan internal dilempar eksplisit.
function findHostOuter(hole, outers) {
  const [px, py] = hole.points[0];
  let host = null;
  for (const outer of outers) {
    if (pointInRing(px, py, outer.points) && (!host || outer.area < host.area)) {
      host = outer;
    }
  }
  if (host) return host;
  const holeBox = ringBbox(hole.points);
  for (const outer of outers) {
    const box = ringBbox(outer.points);
    if (
      box.minX <= holeBox.minX &&
      box.maxX >= holeBox.maxX &&
      box.minY <= holeBox.minY &&
      box.maxY >= holeBox.maxY &&
      (!host || outer.area < host.area)
    ) {
      host = outer;
    }
  }
  if (!host) {
    throw new Error('Kesalahan internal: lubang siluet tidak berada di dalam kontur luar mana pun.');
  }
  return host;
}

// Uji titik-dalam-cincin dengan aturan paritas (ray casting); kontur berupa
// cincin titik tanpa duplikat penutup.
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function ringBbox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/* ---------- Serialisasi ---------- */

// pathD meniru format serializer asli Alight Motion: "M x y" lalu "L x y" per
// titik, dengan titik awal diulang sebagai L terakhir sebelum penutup "Z".
function pathD(points, offsetX, offsetY) {
  const x0 = points[0][0] - offsetX;
  const y0 = points[0][1] - offsetY;
  let d = 'M ' + x0 + ' ' + y0;
  for (let i = 1; i < points.length; i += 1) {
    d += 'L ' + (points[i][0] - offsetX) + ' ' + (points[i][1] - offsetY);
  }
  return d + 'L ' + x0 + ' ' + y0 + 'Z';
}

// polylineD meniru pola path stroke ekspor asli: "M x0 y0" lalu "L x y" per
// titik dengan titik awal diulang sebagai L terakhir, TANPA penutup "Z" —
// garis terbuka pada mode garis.
function polylineD(points, offsetX, offsetY) {
  const x0 = points[0][0] - offsetX;
  const y0 = points[0][1] - offsetY;
  let d = 'M ' + x0 + ' ' + y0;
  for (let i = 1; i < points.length; i += 1) {
    d += 'L ' + (points[i][0] - offsetX) + ' ' + (points[i][1] - offsetY);
  }
  return d + 'L ' + x0 + ' ' + y0;
}

function formatNumber(value) {
  return value.toFixed(6);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
