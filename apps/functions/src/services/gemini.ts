import { GoogleGenAI, ThinkingLevel, type GoogleGenAIOptions } from '@google/genai'
import type { Env } from '../env'
import { DIAGNOSIS_RESPONSE_SCHEMA, type GenerateFn } from './diagnosisModel'

export interface JsonModelConfig {
  responseJsonSchema: object
  temperature: number
  maxOutputTokens: number
  // Gemini 3.x takes a thinking level (a token budget is rejected). Low keeps each call well
  // inside the 30 s demo budget.
  thinkingLevel: ThinkingLevel
  timeoutMs: number
}

// Gemini through the Google Gen AI SDK on Vertex AI (CLAUDE.md invariant 7), on the EU
// multi-region endpoint (env.ts explains why), replying in JSON to a response schema. On Cloud
// Run it authenticates as the service account; local tools may pass their own auth client.
export function geminiJsonModel(
  env: Pick<Env, 'projectId' | 'geminiLocation' | 'geminiModel'>,
  config: JsonModelConfig,
  googleAuthOptions?: GoogleGenAIOptions['googleAuthOptions']
): GenerateFn {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.projectId,
    location: env.geminiLocation,
    googleAuthOptions,
  })

  return async ({ system, user, photos }) => {
    const response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [
            ...photos.map(photo => ({
              inlineData: { mimeType: photo.mimeType, data: photo.data },
            })),
            { text: user },
          ],
        },
      ],
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: config.responseJsonSchema,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        thinkingConfig: { thinkingLevel: config.thinkingLevel },
        httpOptions: { timeout: config.timeoutMs },
      },
    })
    return { text: response.text ?? '', modelVersion: response.modelVersion ?? null }
  }
}

export function geminiDiagnosisModel(
  env: Pick<Env, 'projectId' | 'geminiLocation' | 'geminiModel'>,
  googleAuthOptions?: GoogleGenAIOptions['googleAuthOptions']
): GenerateFn {
  return geminiJsonModel(
    env,
    {
      responseJsonSchema: DIAGNOSIS_RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 4096,
      thinkingLevel: ThinkingLevel.LOW,
      timeoutMs: 45_000,
    },
    googleAuthOptions
  )
}
