export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatParams {
  systemPrompt: string;
  temperature: number;
  contextSize: number;
  maxTokens: number;
}

export interface ChatSession {
  id: string;
  modelId: string;
  title: string;
  messages: ChatMessage[];
  params: ChatParams;
  createdAt: string;
  updatedAt: string;
}

export type ChatEventType = 'token' | 'done' | 'error';

export interface ChatTokenEvent {
  type: 'token';
  delta: string;
}

export interface ChatDoneEvent {
  type: 'done';
}

export interface ChatErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type ChatEvent = ChatTokenEvent | ChatDoneEvent | ChatErrorEvent;

export interface ChatStreamRequest {
  model: string;
  messages: Array<{ role: ChatRole; content: string }>;
  stream: boolean;
  temperature: number;
  max_tokens: number;
}

export function defaultParams(): ChatParams {
  return {
    systemPrompt: '',
    temperature: 0.7,
    contextSize: 4096,
    maxTokens: 2048,
  };
}

export function newMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function newSession(modelId: string): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    modelId,
    title: '',
    messages: [],
    params: defaultParams(),
    createdAt: now,
    updatedAt: now,
  };
}

export function clampTemperature(temp: number): number {
  return Math.max(0, Math.min(2, temp));
}

export function clampMaxTokens(tokens: number): number {
  return Math.max(1, Math.min(32768, tokens));
}

export function validateSession(data: unknown): data is ChatSession {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.modelId === 'string' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.messages) &&
    typeof obj.params === 'object' &&
    obj.params !== null &&
    typeof (obj.params as Record<string, unknown>).temperature === 'number'
  );
}

export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return 'New Chat';
  return firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '');
}
