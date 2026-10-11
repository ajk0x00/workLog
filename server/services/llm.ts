import { z } from 'zod';
import { ChatFireworks } from '@langchain/fireworks';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { config } from '../config.js';

export interface FireworksMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCallOptions {
  temperature?: number;
  maxTokens?: number;
}

export class FireworksError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'FireworksError';
    this.statusCode = statusCode;
  }
}

function toLangChainMessages(messages: FireworksMessage[]) {
  return messages.map((m) => {
    if (m.role === 'system') return new SystemMessage(m.content);
    if (m.role === 'assistant') return new AIMessage(m.content);
    return new HumanMessage(m.content);
  });
}

function createModel(options: LlmCallOptions): ChatFireworks {
  if (!config.fireworks.apiKey) {
    throw new FireworksError(
      'LLM features are not configured. Set FIREWORKS_API_KEY in the environment.',
      503
    );
  }
  return new ChatFireworks({
    apiKey: config.fireworks.apiKey,
    model: config.fireworks.model,
    temperature: options.temperature ?? 0.4,
    maxTokens: options.maxTokens ?? 4096,
    maxRetries: 1,
  });
}

export async function chatCompletion(
  messages: FireworksMessage[],
  options: LlmCallOptions = {}
): Promise<string> {
  try {
    const model = createModel(options);
    const result = await model.invoke(toLangChainMessages(messages));
    const content = typeof result.content === 'string' ? result.content : String(result.content);
    if (!content.trim()) {
      throw new FireworksError('LLM returned an empty response.');
    }
    return content;
  } catch (err: any) {
    if (err instanceof FireworksError) throw err;
    throw new FireworksError(`LLM call failed: ${err.message}`);
  }
}

export async function* chatCompletionStream(
  messages: FireworksMessage[],
  options: LlmCallOptions = {}
): AsyncGenerator<string> {
  let stream: Awaited<ReturnType<ChatFireworks['stream']>>;
  try {
    const model = createModel(options);
    stream = await model.stream(toLangChainMessages(messages));
  } catch (err: any) {
    if (err instanceof FireworksError) throw err;
    throw new FireworksError(`LLM call failed: ${err.message}`);
  }

  for await (const chunk of stream) {
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    if (content) yield content;
  }
}

export async function structuredOutput<T>(
  schema: z.ZodType<T>,
  messages: FireworksMessage[],
  options: LlmCallOptions = {}
): Promise<T> {
  try {
    const model = createModel({ temperature: 0.2, ...options });
    const llm = model.withStructuredOutput(schema);
    return (await llm.invoke(toLangChainMessages(messages))) as T;
  } catch (err: any) {
    if (err instanceof FireworksError) throw err;
    throw new FireworksError(`LLM structured output failed: ${err.message}`);
  }
}

export function currentModel(): string {
  return config.fireworks.model;
}
