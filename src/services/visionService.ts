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
// Detecta si un color RGB es tono de piel humana
// Los tonos de piel tienen: R alto, G medio, B bajo
// y una saturación relativamente baja
// ─────────────────────────────────────────────
const isSkinTone = (r: number, g: number, b: number): boolean => {
  // Condición 1: R debe ser el canal dominante
  if (r <= g || r <= b) return false;

  // Condición 2: rango típico de tonos de piel en RGB
  if (r < 60 || r > 255) return false;
  if (g < 30 || g > 220) return false;
  if (b < 15 || b > 190) return false;

  // Condición 3: diferencia entre R y B debe ser significativa
  if (r - b < 15) return false;

  // Condición 4: convertir a HSV y verificar saturación y matiz
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;

  // Saturación baja a media (piel no es muy saturada)
  const saturation = max === 0 ? 0 : delta / max;
  if (saturation > 0.6) return false;

  // Matiz en rango naranja-rosado (0-50 grados)
  let hue = 0;
  if (delta > 0) {
    if (max === r / 255) {
      hue = 60 * (((g / 255 - b / 255) / delta) % 6);
    } else if (max === g / 255) {
      hue = 60 * ((b / 255 - r / 255) / delta + 2);
    } else {
      hue = 60 * ((r / 255 - g / 255) / delta + 4);
    }
    if (hue < 0) hue += 360;
  }

  // Tonos de piel tienen matiz entre 0 y 50 grados
  return hue >= 0 && hue <= 50;
};

// ─────────────────────────────────────────────
// Detecta si un color es muy claro (blanco/gris claro)
// que típicamente es el fondo de la foto
// ─────────────────────────────────────────────
const isBackgroundColor = (r: number, g: number, b: number): boolean => {
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Muy claro y poco saturado = fondo blanco/gris
  if (brightness > 200 && delta < 30) return true;

  // Muy oscuro y poco saturado = sombra oscura/negro puro
  if (brightness < 20 && delta < 20) return true;

  return false;
};

// ─────────────────────────────────────────────
// Similitud entre dos colores hex
// Usa distancia euclidiana ponderada (el ojo humano
// es más sensible al verde, luego rojo, luego azul)
// ─────────────────────────────────────────────
const colorSimilarity = (hex1: string, hex2: string): number => {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 0;

  // Pesos perceptuales: verde > rojo > azul
  const rWeight = 0.3;
  const gWeight = 0.59;
  const bWeight = 0.11;

  const maxDistance = Math.sqrt(
    rWeight * 255 ** 2 +
    gWeight * 255 ** 2 +
    bWeight * 255 ** 2
  );

  const distance = Math.sqrt(
    rWeight * (c1.r - c2.r) ** 2 +
    gWeight * (c1.g - c2.g) ** 2 +
    bWeight * (c1.b - c2.b) ** 2
  );

  return Math.round((1 - distance / maxDistance) * 100);
};

// ─────────────────────────────────────────────
// Analiza imagen con Vision AI
// Pide 10 colores, filtra piel y fondo,
// devuelve los mejores colores de uñas
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
        features: [
          {
            type: 'IMAGE_PROPERTIES',
            maxResults: 10  // Pedimos 10, luego filtramos
          }
        ]
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

  // Filtrar tonos de piel y fondos, quedarnos con colores de uñas
  const nailColors = colors.filter((colorInfo: any) => {
    const r = colorInfo.color?.red || 0;
    const g = colorInfo.color?.green || 0;
    const b = colorInfo.color?.blue || 0;
    return !isSkinTone(r, g, b) && !isBackgroundColor(r, g, b);
  });

  // Si después de filtrar no queda nada, usar todos los colores
  // (caso extremo: uñas nude que son similares a la piel)
  const colorsToProcess = nailColors.length > 0 ? nailColors : colors;

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
    .sort((a: DetectedColor, b: DetectedColor) => b.score - a.score)
    .slice(0, 5); // Top 5 colores de uñas
};

// ─────────────────────────────────────────────
// Compara colores de uñas detectados con esmaltes
// del inventario
// ─────────────────────────────────────────────
export const matchColorsWithMaterials = (
  detectedColors: DetectedColor[],
  materials: Array<{ id: string; nombre: string; color?: string }>
): ColorMatchResult[] => {
  const materialsWithColor = materials.filter(
    m => m.color && m.color.trim() !== ''
  );

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

    // Umbral de 75%: estricto pero permite coincidencias reales
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