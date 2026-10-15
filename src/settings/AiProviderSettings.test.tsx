import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AiError } from '../ai/aiClient';
import { readAiSettings } from '../ai/aiSettings';
import { AiProviderSettings } from './AiProviderSettings';

function renderAi(testFn?: Parameters<typeof AiProviderSettings>[0]['testFn']) {
  return render(
    <MemoryRouter>
      <AiProviderSettings testFn={testFn} />
    </MemoryRouter>
  );
}

describe('AiProviderSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to Groq and saves the key on this device', () => {
    renderAi();
    expect(screen.getByLabelText('AI provider')).toHaveValue('groq');
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_test' } });
    expect(readAiSettings().apiKey).toBe('gsk_test');
  });

  it('switching to Local fills its URL and model and hides the key', () => {
    renderAi();
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'local' } });
    expect(screen.getByLabelText('Base URL')).toHaveValue('http://localhost:11434/v1');
    expect(screen.getByLabelText('Model')).toHaveValue('qwen2.5:7b-instruct');
    expect(screen.queryByLabelText('API key')).toBeNull();
  });

  it('clears the API key when the provider changes', () => {
    renderAi();
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_test' } });
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'openrouter' } });
    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(readAiSettings().apiKey).toBe('');
  });

  it('names the provider on rate limits and adds the Local hint only for Local', async () => {
    const testFn = vi.fn().mockRejectedValue(new AiError('unreachable', 'x'));
    renderAi(testFn);
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
    renderAi(testFn);
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Key rejected');
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connected'));
  });

  it('toggles the API key visibility', () => {
    renderAi();
    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show API key' }));
    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide API key' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('links to get a key per provider, none for Local', () => {
    renderAi();
    const link = () => screen.queryByRole('link', { name: 'Get a key' });
    expect(link()).toHaveAttribute('href', 'https://console.groq.com/keys');
    expect(link()).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'openrouter' } });
    expect(link()).toHaveAttribute('href', 'https://openrouter.ai/keys');
    expect(screen.getByRole('link', { name: 'Free models' })).toHaveAttribute('href', 'https://openrouter.ai/models?max_price=0');
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'local' } });
    expect(link()).toBeNull();
  });

  it('keeps the key out of localStorage when Remember is unchecked', () => {
    renderAi();
    expect(screen.getByLabelText('Remember on this device')).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_sess' } });
    expect(localStorage.getItem('vcb.ai.settings')).not.toContain('gsk_sess');
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBe('gsk_sess');
    expect(readAiSettings().apiKey).toBe('gsk_sess');
    expect(screen.getByText('Saved on this device')).toBeInTheDocument();
  });

  it('colors the test status', async () => {
    const testFn = vi.fn().mockRejectedValueOnce(new AiError('unreachable', 'x')).mockResolvedValueOnce(undefined);
    renderAi(testFn);
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status').className).toContain('text-red'));
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status').className).toContain('text-green-strong'));
  });

  it('Forget key removes the key from this device', () => {
    renderAi();
    const forget = screen.getByRole('button', { name: 'Forget key' });
    expect(forget).toBeDisabled();
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }));
    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(readAiSettings().apiKey).toBe('');
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBeNull();
  });

  it('leaves "Remember on this device" off for a fresh setup', () => {
    renderAi();
    expect(screen.getByLabelText('Remember on this device')).not.toBeChecked();
  });
});
