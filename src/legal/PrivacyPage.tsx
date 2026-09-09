// DRAFT privacy policy. The app is currently for internal club use only and
// parent/guardian sign-in is not enabled, so this has not yet been through a
// formal legal review — do that before telling any guardian they can log in.
// The data-request contact is the club operator's own address.
import { Link } from 'react-router-dom';

const DATA_REQUEST_CONTACT = 'alberto.valdes.rey.official@gmail.com';

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl p-6 text-ink">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Privacy Policy</h1>

      <p role="note" className="mt-3 rounded-md border border-orange bg-orange/10 p-3 text-sm text-ink">
        Draft policy — internal club use only; parent/guardian access is not yet enabled. Pending
        legal review before any guardian sign-in.
      </p>

      <h2 className="mt-6 text-lg font-semibold">What data we collect</h2>
      <p className="mt-1 text-slate">
        Only the information already recorded in the club&apos;s player spreadsheet: each player&apos;s
        contact and registration details (name, date of birth, nationality, licence number, position,
        phone), their parents&apos; or guardians&apos; contact details, volleyball skill scores and coach
        notes, physical-test measurements, and development-plan objectives and notes. We do not use
        analytics or third-party tracking.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Why we collect it</h2>
      <p className="mt-1 text-slate">
        To manage player development for Volley Club Belair — team rosters, skill tracking, physical
        testing, and training planning.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Who can see it</h2>
      <p className="mt-1 text-slate">
        Club administrators. Once parent access is available, a linked parent or guardian will be able
        to see their own child&apos;s record and nothing else.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Players are minors</h2>
      <p className="mt-1 text-slate">
        Players are aged roughly 13–15. The parent or legal guardian is the party who gives consent for
        their child&apos;s data to be stored, and that consent is recorded per player.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Retention</h2>
      <p className="mt-1 text-slate">
        Data is kept while the player is registered with the club. It is deleted on request, or when the
        player leaves the club.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Your rights and data requests</h2>
      <p className="mt-1 text-slate">
        Parents and guardians can request access to, correction of, or erasure of their child&apos;s data
        by contacting the club at{' '}
        <a className="font-medium text-blue hover:underline" href={`mailto:${DATA_REQUEST_CONTACT}`}>
          {DATA_REQUEST_CONTACT}
        </a>
        .
      </p>

      <h2 className="mt-6 text-lg font-semibold">Security</h2>
      <p className="mt-1 text-slate">
        Data is encrypted in transit (HTTPS) and at rest, and access is controlled by per-record
        security rules.
      </p>

      <p className="mt-8 text-sm">
        <Link to="/login" className="text-blue hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
