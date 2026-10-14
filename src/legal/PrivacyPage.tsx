// DRAFT privacy policy. The app is currently for internal club use only and
// parent/guardian sign-in is not enabled, so this has not yet been through a
// formal legal review — do that before telling any guardian they can log in.
// Kept region-agnostic on purpose: clubs are tenants and may be anywhere in
// the EU; the operator (not a club) is the responsible party for now.
import { usePageMeta } from '../layout/usePageMeta';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const OPERATOR_NAME = 'Alberto Valdes Rey';
const DATA_REQUEST_CONTACT = 'alberto.valdes.rey.official@gmail.com';
const LAST_UPDATED = '14 October 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="mt-6 text-lg font-semibold">{title}</h2>
      <div className="mt-1 flex flex-col gap-2 text-slate">{children}</div>
    </>
  );
}

function Contact() {
  return (
    <a className="text-blue hover:underline" href={`mailto:${DATA_REQUEST_CONTACT}`}>
      {DATA_REQUEST_CONTACT}
    </a>
  );
}

export function PrivacyPage() {
  usePageMeta({ title: 'Privacy', description: 'How Volley Skills handles player and guardian data.', robots: 'index', canonicalPath: '/privacy' });
  return (
    <div className="mx-auto max-w-2xl p-6 text-ink">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Privacy Policy</h1>
      <p className="mt-1 text-sm text-slate">Last updated {LAST_UPDATED}</p>

      <p role="note" className="mt-3 rounded-md border border-orange bg-orange/10 p-3 text-sm text-ink">
        Draft policy — internal club use only; parent/guardian access is not yet enabled. Pending
        legal review before any guardian sign-in.
      </p>

      <Section title="Who is responsible">
        <p>
          This app is run by {OPERATOR_NAME} (&quot;we&quot;), who decides how the personal data in it is used and is
          responsible for it under the EU General Data Protection Regulation (GDPR). Volleyball clubs use the app to
          manage their own teams. Contact: <Contact />.
        </p>
      </Section>

      <Section title="What data we collect">
        <p>
          <strong className="font-medium text-ink">About players:</strong> the details a club already keeps on its
          player sheets — name, date of birth, nationality, licence number, jersey number, position, shirt size and
          phone; their parents&apos; or guardians&apos; names, relation, phone and email; volleyball skill scores and
          coach notes; development-plan objectives and notes; physical-test measurements (such as height, body mass,
          jump and sprint results); and their match line-ups and scouting statistics.
        </p>
        <p>
          <strong className="font-medium text-ink">About coaches and administrators:</strong> your email address,
          and your name and profile picture if you sign in with Google.
        </p>
        <p>
          <strong className="font-medium text-ink">About people who request access:</strong> the name, email and
          role entered on the request page.
        </p>
        <p>We do not use analytics, advertising or third-party tracking.</p>
      </Section>

      <Section title="Why we collect it">
        <p>
          To help clubs manage player development — team rosters, skill tracking, physical testing, match scouting
          and training planning — and to let coaches sign in and handle access requests.
        </p>
        <p>
          Legal basis: player data is stored with the consent of the player&apos;s parent or legal guardian,
          recorded per player, which can be withdrawn at any time. Physical-test results are sports performance
          measurements used for training, not medical data. Coach accounts and access requests are handled
          because you asked to use the app.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          The coaches and administrators of the player&apos;s team, and the app operator. Once parent access is
          available, a linked parent or guardian will be able to see their own child&apos;s record and nothing else.
          We do not sell or share the data with anyone else, except the service providers below.
        </p>
      </Section>

      <Section title="Award cards">
        <p>
          Photos added to award cards are processed only in your browser to create the image; they are never
          uploaded or stored by Volley Skills.
        </p>
      </Section>

      <Section title="Service providers">
        <p>
          The app runs on Google Firebase (sign-in, database and hosting), which processes the data on our behalf
          under Google&apos;s data-processing terms. Those terms include the safeguards GDPR requires when data is
          handled outside the EU.
        </p>
      </Section>

      <Section title="Text scouting (optional)">
        <p>
          If a coach enables text scouting, their typed match notes are sent to the AI provider they choose in
          Settings (Groq by default, OpenRouter, another compatible service, or a model running on their own computer
          — in which case nothing leaves it) to be turned into scouting actions. Groq and OpenRouter are based in the
          United States, so these notes leave the EU. Through OpenRouter, notes only go to model providers that keep
          nothing and never train on them; Groq does not keep requests by default.
        </p>
        <p>
          Player names are replaced by jersey numbers on the device before sending; only jersey numbers, playing
          roles, the set, score, serving side and rotation, and the notes are sent. Coaches are asked not to type
          names (including opponents&apos;) or health details in the notes. The provider key and drafts are stored only
          on that device and removed on sign-out.
        </p>
      </Section>

      <Section title="Players are minors">
        <p>
          Players are usually under 18. The parent or legal guardian is the party who gives consent for their
          child&apos;s data to be stored, and that consent is recorded per player. Children under 16 should ask a
          parent or guardian to request access for them.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          Player data is kept while the player is with the club and for 12 months after they leave (one season, so a
          returning player keeps their history), then deleted. It is deleted sooner on request. Deleting a player also deletes their physical tests and testing-session entries, and
          removes their name and number from past match reports; the team&apos;s match totals stay, no longer linked to
          them.
        </p>
        <p>Access requests are deleted once they have been handled.</p>
      </Section>

      <Section title="Your rights and data requests">
        <p>
          You — or, for a player, their parent or guardian — can ask for a copy of the data (as a file you can take
          elsewhere), its correction or erasure, to restrict or object to its use, or withdraw consent, by contacting{' '}
          <Contact />. We answer within one month.
        </p>
        <p>
          You can also complain to the data-protection authority of the EU country where you live, work, or where you
          think the problem happened.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Data is encrypted in transit (HTTPS) and at rest, and access is controlled by per-record security rules. So
          that matches can be scouted without a signal, match and player data may be cached on the device until you
          sign out; signing out clears it.
        </p>
      </Section>

      <Section title="Changes">
        <p>We will update this page when what we collect or how we use it changes, and change the date above.</p>
      </Section>

      <p className="mt-8">
        <Link to="/login" className="text-blue hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
