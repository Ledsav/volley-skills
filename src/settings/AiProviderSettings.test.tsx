import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../matches/text/aiClient';
import { readAiSettings } from '../matches/text/aiSettings';
import { AiProviderSettings } from './AiProviderSettings';

describe('AiProviderSettings', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Groq and saves the key on this device', () => {
    render(<AiProviderSettings />);
    expect(screen.getByLabelText('AI provider')).toHaveValue('groq');
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_test' } });
    expect(readAiSettings().apiKey).toBe('gsk_test');
  });

  it('switching to Local fills its URL and model and hides the key', () => {
    render(<AiProviderSettings />);
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'local' } });
    expect(screen.getByLabelText('Base URL')).toHaveValue('http://localhost:11434/v1');
    expect(screen.getByLabelText('Model')).toHaveValue('qwen2.5:7b-instruct');
    expect(screen.queryByLabelText('API key')).toBeNull();
  });

  it('clears the API key when the provider changes', () => {
    render(<AiProviderSettings />);
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_test' } });
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'openrouter' } });
    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(readAiSettings().apiKey).toBe('');
  });

  it('names the provider on rate limits and adds the Local hint only for Local', async () => {
    const testFn = vi.fn().mockRejectedValue(new AiError('unreachable', 'x'));
    render(<AiProviderSettings testFn={testFn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not reach the provider.'));
    expect(screen.getByRole('status')).not.toHaveTextContent('Ollama');
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Is Ollama / LM Studio running'));
    testFn.mockRejectedValue(new AiError('rateLimited', 'x', 429));
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'groq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Groq rate limit reached'));
  });

  it('reports the Test connection result', async () => {
    const testFn = vi.fn().mockRejectedValueOnce(new AiError('unauthorized', 'Key rejected.', 401)).mockResolvedValueOnce(undefined);
    render(<AiProviderSettings testFn={testFn} />);
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Key rejected');
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connected'));
  });
});
