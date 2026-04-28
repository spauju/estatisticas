import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    // Tenta pegar de várias fontes possíveis
    const apiKey = (import.meta.env?.VITE_GEMINI_API_KEY) || 
                   (process.env?.VITE_GEMINI_API_KEY) || 
                   (process.env?.GEMINI_API_KEY);

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '' || apiKey === 'undefined') {
      throw new Error("Chave Gemini não configurada. Verifique se a variável VITE_GEMINI_API_KEY está definida no seu ambiente e REFAÇA O DEPLOY (Netlify/Vercel).");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface ParallelismClass {
  deviationCm: number;
  totalPercentage: number;
  details: string[];
}

export interface AnalysisResult {
  classes: ParallelismClass[];
  rawExtractions: Array<{ side: string; deviation: number; percentage: number }>;
}

export async function analyzeChartFile(
  fileBase64: string,
  mimeType: string
): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analise este gráfico de paralelismo. Extraia todos os desvios de paralelismo mencionados.
    Para cada desvio, identifique:
    1. O valor do desvio em cm (pode ser positivo ou negativo).
    2. A porcentagem (%) associada a esse desvio.
    3. De qual lado ou parte do gráfico isso se refere (ex: esquerda, direita, lado A, lado B).

    Depois de extrair, agrupe os valores pelo VALOR ABSOLUTO do desvio (ex: +5cm e -5cm pertencem à classe de 5cm).
    Some as porcentagens de cada classe.

    Retorne os dados formatados em JSON conforme o esquema solicitado.
  `;

  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            data: fileBase64,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rawExtractions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                side: { type: Type.STRING },
                deviation: { type: Type.NUMBER },
                percentage: { type: Type.NUMBER },
              },
              required: ["side", "deviation", "percentage"],
            },
          },
          classes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                deviationCm: { type: Type.NUMBER },
                totalPercentage: { type: Type.NUMBER },
                details: {
                   type: Type.ARRAY,
                   items: { type: Type.STRING }
                }
              },
              required: ["deviationCm", "totalPercentage", "details"],
            },
          },
        },
        required: ["rawExtractions", "classes"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Falha na análise do modelo.");

  return JSON.parse(text) as AnalysisResult;
}
