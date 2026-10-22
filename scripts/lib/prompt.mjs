// Terminal prompts for the ops and migration scripts. Run the scripts in your own shell:
// a passphrase needs keyboard input, and a prompt that gets none fails instead of waiting.
import { createInterface } from 'node:readline';

/** Asks each question in turn on one muted reader (answers are not echoed). */
function askMuted(questions) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (s) => {
      if (!muted) process.stdout.write(s);
    };
    const answers = [];
    const next = () => {
      muted = false;
      rl.question(questions[answers.length], (answer) => {
        process.stdout.write('\n');
        answers.push(answer);
        if (answers.length === questions.length) rl.close();
        else next();
      });
      muted = true;
    };
    rl.on('close', () => (answers.length === questions.length ? resolve(answers) : reject(new Error('No input: run this in your own terminal.'))));
    next();
  });
}

/** Asks a question without echoing the answer (passphrases). */
export async function askSecret(question) {
  return (await askMuted([question]))[0];
}

/** Asks for a new passphrase twice; rejects when the two differ. */
export async function askNewSecret(question) {
  const [first, again] = await askMuted([question, 'Type it again: ']);
  if (first !== again) throw new Error('The two passphrases differ.');
  return first;
}

/** Resolves only when the person types `expected` exactly; anything else exits. */
export async function confirmTyped(question, expected) {
  process.stdout.write(`${question}\nType "${expected}" to continue: `);
  const answer = await new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (d) => {
      process.stdin.pause();
      resolve(String(d).trim());
    });
  });
  if (answer !== expected) {
    console.error('Not confirmed. Nothing was written.');
    process.exit(1);
  }
}
