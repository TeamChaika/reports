import OpenAI from 'openai'

export const ai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY']!,
  defaultHeaders: {
    'HTTP-Referer': process.env['NEXT_PUBLIC_APP_URL'] ?? '',
    'X-Title': 'Shift Reports Analytics',
  },
})

export const AI_MODEL = 'anthropic/claude-sonnet-4-6'
