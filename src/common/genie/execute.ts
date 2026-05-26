import type {
  GenieExecutePromptRequest,
  GenieExecutePromptResponse,
} from './types';

export async function executeGeniePrompt(
  payload: GenieExecutePromptRequest,
): Promise<GenieExecutePromptResponse> {
  const response = await fetch('/api/prompt/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error || '自动执行失败');
  }

  return result;
}
