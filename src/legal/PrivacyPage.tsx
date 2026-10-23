import { LegalDocView } from './LegalDocPage';

/** The privacy notice: rendered from the same Markdown texts as the other legal pages. */
export function PrivacyPage() {
  return <LegalDocView doc="privacy" canonicalPath="/privacy" />;
}
