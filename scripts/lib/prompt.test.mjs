// @vitest-environment node
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { askNewSecret, askSecret, askTyped } from './prompt.mjs';

function terminal() {
  const input = new PassThrough();
  const output = new PassThrough();
  output.resume();
  return { input, output, type: (line) => setTimeout(() => input.write(`${line}\n`), 20) };
}

const within = (promise, ms = 2000) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timed out waiting for input')), ms))]);

describe('prompts', () => {
  it('reads a typed confirmation after a passphrase prompt', async () => {
    const io = terminal();
    io.type('a long passphrase');
    expect(await within(askSecret('Passphrase: ', io))).toBe('a long passphrase');
    io.type('volley-skills');
    expect(await within(askTyped('Type "volley-skills": ', io))).toBe('volley-skills');
  });

  it('reads two passphrases in a row', async () => {
    const io = terminal();
    io.type('first passphrase');
    expect(await within(askSecret('One: ', io))).toBe('first passphrase');
    io.type('second passphrase');
    expect(await within(askSecret('Two: ', io))).toBe('second passphrase');
  });

  it('asks a new passphrase twice and refuses a mismatch', async () => {
    const io = terminal();
    setTimeout(() => io.input.write('same passphrase!\nother passphrase\n'), 20);
    await expect(within(askNewSecret('New: ', io))).rejects.toThrow(/differ/);
  });

  it('fails instead of waiting when the input ends', async () => {
    const io = terminal();
    setTimeout(() => io.input.end(), 20);
    await expect(within(askSecret('Passphrase: ', io))).rejects.toThrow(/No input/);
  });
});
