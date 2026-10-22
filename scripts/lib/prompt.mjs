// Terminal prompts for the ops, migration and seed scripts. Run the scripts in your own
// shell: a passphrase needs keyboard input, and a prompt that gets none fails instead of
// waiting. Every prompt goes through readline, which resumes the input stream it reads:
// a bare stdin 'data' listener after a closed readline would wait forever (stdin stays paused).
import { createInterface } from 'node:readline';

const STDIO = { input: process.stdin, output: process.stdout };

/** Asks each question in turn on one reader; `muted` hides the answers (passphrases). */
function ask(questions, { input, output } = STDIO, { muted }) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input, output, terminal: true });
    let hidden = false;
    if (muted) {
      rl._writeToOutput = (s) => {
        if (!hidden) output.write(s);
      };
    }
    const answers = [];
    const next = () => {
      hidden = false;
      rl.question(questions[answers.length], (answer) => {
        if (muted) output.write('\n');
        answers.push(answer);
        if (answers.length === questions.length) rl.close();
        else next();
      });
      hidden = true;
    };
    rl.on('close', () => (answers.length === questions.length ? resolve(answers) : reject(new Error('No input: run this in your own terminal.'))));
    next();
  });
}

/** Asks a question without echoing the answer (passphrases). */
export async function askSecret(question, io = STDIO) {
  return (await ask([question], io, { muted: true }))[0];
}

/** Asks for a new passphrase twice; rejects when the two differ. */
export async function askNewSecret(question, io = STDIO) {
  const [first, again] = await ask([question, 'Type it again: '], io, { muted: true });
  if (first !== again) throw new Error('The two passphrases differ.');
  return first;
}

/** Asks a question and returns the trimmed answer (shown as typed). */
export async function askTyped(question, io = STDIO) {
  return (await ask([question], io, { muted: false }))[0].trim();
}

/** Resolves only when the person types `expected` exactly; anything else exits. */
export async function confirmTyped(question, expected) {
  let answer = '';
  try {
    answer = await askTyped(`${question}\nType "${expected}" to continue: `);
  } catch {
    // No input: treated as not confirmed.
  }
  if (answer !== expected) {
    console.error('Not confirmed. Nothing was written.');
    process.exit(1);
  }
}
