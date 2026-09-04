import { useState, type FormEvent } from 'react';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '../firebase/config';
import { saveEmailForSignIn } from './emailLinkStorage';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/finish-sign-in`,
        handleCodeInApp: true,
      });
      saveEmailForSignIn(email);
      setSent(true);
    } catch {
      setError('Could not send sign-in link. Please check the email address and try again.');
    }
  }

  if (sent) {
    return <p>Check your email for a sign-in link.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <button type="submit">Send sign-in link</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
