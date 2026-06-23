export interface ExtractedInventoryData {
  materialName: string | null;
}

export interface InventorySearchResult {
  success: boolean;
  data: ExtractedInventoryData | null;
  rawText: string;
  error: string | null;
  confidence: number;
}

const INVENTORY_VOICE_SYSTEM_PROMPT = `Eres un asistente especializado en extraer nombres de materiales de un salón de belleza de uñas.

Tu única tarea es identificar el NOMBRE del material o producto que la manicurista está consultando.

Analiza el texto hablado y extrae el nombre del material siguiendo estas reglas:

REGLAS ESTRICTAS:
1. El texto puede contener patrones como: "cuánto", "cuántas", "queda", "hay", "existe", "busca", "revisar", "verificar", "consultar", "stock", "inventario", "existencia"
2. El nombre del material puede estar al inicio, medio o final del texto
3. Pueden incluirse descripciones de color, marca, tamaño o tipo (ej: "esmalte rojo", "acrílico cristal", "lima 100/180")
4. Si la frase menciona "cuánto queda de [material]" o "[material] cuántas unidades hay", el material es lo que viene después de "de" o después de la pregunta
5. Devuelve SOLO el nombre del material sin artículos, pronombres o palabras de búsqueda
6. Si no puedes identificar un material claro, devuelve null
7. NO inventes nombres - si no hay un material en el texto, usa null
8. Devuelve SOLO el JSON con el formato exacto, sin texto adicional ni explicaciones

Ejemplos:
- "¿Cuánto esmalte semipermanente rojo queda?" → "esmalte semipermanente rojo"
- "Revisar stock de acrílico cristal" → "acrílico cristal"
- "Busca cuántas limas 100/180 tenemos" → "limas 100/180"
- "Cuántas unidades de base coat hay?" → "base coat"
- "Hay gel UV transparente?" → "gel UV transparente"
- "Verificar existencia de polish gel" → "polish gel"
- "Hola qué tal" → null
- "Necesito agendar" → null

Devuelve SOLO el JSON con este formato exacto:
{"materialName": "nombre del material o null"}`;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class InventoryVoiceService {
  private apiKey: string | null = null;
  private model: string = 'llama-3.3-70b-versatile';

  constructor() {
    this.apiKey = import.meta.env.VITE_GROQ_API_KEY || null;
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = 1000;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === retries) {
          throw lastError;
        }

        const isRetryable = this.isRetryableError(error);

        if (isRetryable) {
          console.warn(`Groq API retryable error, waiting ${delay}ms... (attempt ${attempt + 1}/${retries})`);
          await this.sleep(delay);
          delay *= 2;
        } else {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('overloaded') ||
        message.includes('too many requests') ||
        message.includes('timeout') ||
        message.includes('503')
      );
    }
    return false;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('429') || message.includes('rate limit')) {
        return 'Límite de uso alcanzado. Espera unos segundos e intenta de nuevo.';
      }
      if (message.includes('overloaded')) {
        return 'Groq está sobrecargado. Espera un momento e intenta de nuevo.';
      }
      if (message.includes('invalid api key') || message.includes('unauthorized')) {
        return 'API key de Groq inválida. Verifica tu VITE_GROQ_API_KEY.';
      }
      if (message.includes('model')) {
        return 'Modelo no disponible. Verifica el nombre del modelo.';
      }
      return error.message;
    }
    return 'Error desconocido de Groq';
  }

  async extractMaterialName(transcribedText: string): Promise<InventorySearchResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        data: null,
        rawText: transcribedText,
        error: 'Groq API no está configurada. Agrega VITE_GROQ_API_KEY a tu archivo .env',
        confidence: 0,
      };
    }

    try {
      const response = await this.executeWithRetry(async () => {
        const res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: INVENTORY_VOICE_SYSTEM_PROMPT,
              },
              {
                role: 'user',
                content: transcribedText,
              },
            ],
            temperature: 0.1,
            max_tokens: 100,
            response_format: { type: 'json_object' },
          }),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`Groq API error ${res.status}: ${errorBody}`);
        }

        return res.json();
      });

      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'Respuesta vacía de Groq',
          confidence: 0,
        };
      }

      let parsedData: ExtractedInventoryData;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        parsedData = JSON.parse(jsonString) as ExtractedInventoryData;
      } catch {
        return {
          success: false,
          data: null,
          rawText: transcribedText,
          error: 'Error al parsear la respuesta como JSON',
          confidence: 0,
        };
      }

      const hasMaterialName = parsedData.materialName && parsedData.materialName.trim().length > 0;
      const confidence = hasMaterialName ? 1 : 0;

      return {
        success: hasMaterialName,
        data: parsedData,
        rawText: transcribedText,
        error: hasMaterialName ? null : 'No se pudo identificar un nombre de material en el comando de voz',
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        rawText: transcribedText,
        error: this.getErrorMessage(error),
        confidence: 0,
      };
    }
  }
}

let inventoryVoiceServiceInstance: InventoryVoiceService | null = null;

export function getInventoryVoiceService(): InventoryVoiceService {
  if (!inventoryVoiceServiceInstance) {
    inventoryVoiceServiceInstance = new InventoryVoiceService();
  }
  return inventoryVoiceServiceInstance;
}