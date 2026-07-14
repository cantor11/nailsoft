const VISION_API_KEY = import.meta.env.VITE_VISION_API_KEY;
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;

export interface DetectedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  score: number;
  pixelFraction: number;
  percentage: number;
}

export interface ColorMatchResult {
  materialId: string;
  materialName: string;
  materialColor: string;
  similarity: number;
  hex: string;
}

const toHex = (value: number): string => {
  const clamped = Math.round(Math.max(0, Math.min(255, value || 0)));
  const hex = clamped.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16)
  };
};

// ─────────────────────────────────────────────
// Convierte RGB a HSL
// Retorna h(0-360), s(0-1), l(0-1)
// ─────────────────────────────────────────────
const rgbToHsl = (r: number, g: number, b: number) => {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rN) h = ((gN - bN) / delta) % 6;
    else if (max === gN) h = (bN - rN) / delta + 2;
    else h = (rN - gN) / delta + 4;
    h = h * 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
};

// ─────────────────────────────────────────────
// Determina si un color debe ser descartado
// Filtra: piel, fondos, sombras, negros, grises
// ─────────────────────────────────────────────
const shouldDiscard = (r: number, g: number, b: number): boolean => {
  const { h, s, l } = rgbToHsl(r, g, b);
  const brightness = (r + g + b) / 3;

  // 1. Descartar colores muy oscuros (sombras, fondos oscuros, bordes de uñas)
  // Esto incluye negros reales Y sombras entre dedos
  if (brightness < 45) return true;

  // 2. Descartar colores muy claros sin saturación (fondos blancos/grises claros)
  if (l > 0.85 && s < 0.15) return true;

  // 3. Descartar grises de cualquier tono (poca saturación)
  // Los esmaltes siempre tienen saturación notable excepto el blanco/negro puro
  if (s < 0.12 && l > 0.15 && l < 0.85) return true;

  // 4. Descartar tonos de piel
  // Piel: matiz naranja-amarillo (0-40°), saturación baja-media, luminosidad media
  if (h >= 0 && h <= 40 && s >= 0.1 && s <= 0.65 && l >= 0.35 && l <= 0.75) return true;

  // 5. Descartar tonos muy beige/café que son piel oscura o fondos cálidos
  if (h >= 20 && h <= 50 && s <= 0.5 && l >= 0.25 && l <= 0.65) return true;

  return false;
};

// ─────────────────────────────────────────────
// Similitud perceptual entre dos colores hex
// ─────────────────────────────────────────────
const colorSimilarity = (hex1: string, hex2: string): number => {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 0;

  // Pesos perceptuales CIE
  const rW = 0.3, gW = 0.59, bW = 0.11;
  const maxDist = Math.sqrt(rW * 255 ** 2 + gW * 255 ** 2 + bW * 255 ** 2);
  const dist = Math.sqrt(
    rW * (c1.r - c2.r) ** 2 +
    gW * (c1.g - c2.g) ** 2 +
    bW * (c1.b - c2.b) ** 2
  );

  return Math.round((1 - dist / maxDist) * 100);
};

// ─────────────────────────────────────────────
// Analiza imagen con Vision AI
// ─────────────────────────────────────────────
export const analyzeImage = async (imageBase64: string): Promise<DetectedColor[]> => {
  if (!VISION_API_KEY) {
    throw new Error('VITE_VISION_API_KEY no está configurada en el .env');
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  const requestBody = {
    requests: [
      {
        image: { content: cleanBase64 },
        features: [{ type: 'IMAGE_PROPERTIES', maxResults: 20 }]
      }
    ]
  };

  const response = await fetch(VISION_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error llamando a Vision AI');
  }

  const data = await response.json();
  const colors = data.responses?.[0]?.imagePropertiesAnnotation?.dominantColors?.colors;
  if (!colors || colors.length === 0) return [];

  // Filtrar colores no deseados
  const nailColors = colors.filter((colorInfo: any) => {
    const r = colorInfo.color?.red || 0;
    const g = colorInfo.color?.green || 0;
    const b = colorInfo.color?.blue || 0;
    return !shouldDiscard(r, g, b);
  });

  // Si el filtro eliminó todo, usamos los menos descartables
  // (caso: uñas nude muy similares a piel)
  const colorsToProcess = nailColors.length > 0
    ? nailColors
    : colors.filter((c: any) => {
        const brightness = ((c.color?.red || 0) + (c.color?.green || 0) + (c.color?.blue || 0)) / 3;
        return brightness > 40; // Al menos descartar negros absolutos
      }).slice(0, 3);

  const totalScore = colorsToProcess.reduce(
    (sum: number, c: any) => sum + (c.score || 0), 0
  );

  return colorsToProcess
    .map((colorInfo: any) => {
      const r = colorInfo.color?.red || 0;
      const g = colorInfo.color?.green || 0;
      const b = colorInfo.color?.blue || 0;
      const score = colorInfo.score || 0;
      return {
        hex: rgbToHex(r, g, b),
        rgb: { r: Math.round(r), g: Math.round(g), b: Math.round(b) },
        score,
        pixelFraction: colorInfo.pixelFraction || 0,
        percentage: totalScore > 0
          ? Math.round((score / totalScore) * 100 * 10) / 10
          : 0
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
};

// ─────────────────────────────────────────────
// Compara colores detectados con esmaltes
// ─────────────────────────────────────────────
export const matchColorsWithMaterials = (
  detectedColors: DetectedColor[],
  materials: Array<{ id: string; nombre: string; color?: string }>
): ColorMatchResult[] => {
  const materialsWithColor = materials.filter(m => m.color && m.color.trim() !== '');
  if (materialsWithColor.length === 0 || detectedColors.length === 0) return [];

  const results: ColorMatchResult[] = [];

  materialsWithColor.forEach(material => {
    let bestSimilarity = 0;
    let bestDetectedHex = '';

    detectedColors.forEach(detected => {
      const similarity = colorSimilarity(material.color!, detected.hex);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestDetectedHex = detected.hex;
      }
    });

    if (bestSimilarity >= 75) {
      results.push({
        materialId: material.id,
        materialName: material.nombre,
        materialColor: material.color!,
        similarity: bestSimilarity,
        hex: bestDetectedHex
      });
    }
  });

  return results.sort((a, b) => b.similarity - a.similarity);
};