import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * A small Markdown renderer for the legal texts. It builds React elements only
 * (no raw HTML) and supports exactly: # ## ### headings, paragraphs, - and 1.
 * lists, **bold**, `code`, [label](href), > quotes and | tables.
 */

type SafeHref = { kind: 'internal' | 'external' | 'mail'; href: string };

/** Only /…, https://… and mailto:… are links; anything else is plain text. */
function safeHref(raw: string): SafeHref | null {
  const href = raw.trim();
  if (/^\/(?![/\\])/.test(href)) return { kind: 'internal', href };
  if (/^https:\/\/[^\s]+$/i.test(href)) return { kind: 'external', href };
  if (/^mailto:[^\s]+$/i.test(href)) return { kind: 'mail', href };
  return null;
}

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/;

function inline(text: string, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={key} className="font-semibold">{inline(m[1], key)}</strong>);
    } else if (m[2] !== undefined) {
      out.push(<code key={key} className="rounded-sm bg-bg px-1 text-sm">{m[2]}</code>);
    } else {
      const label = inline(m[3], key);
      const link = safeHref(m[4]);
      if (!link) out.push(<Fragment key={key}>{label}</Fragment>);
      else if (link.kind === 'internal') out.push(<Link key={key} to={link.href} className="text-blue hover:underline">{label}</Link>);
      else if (link.kind === 'external') out.push(<a key={key} href={link.href} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline">{label}</a>);
      else out.push(<a key={key} href={link.href} className="text-blue hover:underline">{label}</a>);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const HEADING = /^(#{1,3}) (.*)$/;
const CLAUSE = /^([TD]\d+)\. /;
const UL = /^[-*] (.*)$/;
const OL = /^\d+\. (.*)$/;
const isTableRow = (l: string) => l.trim().startsWith('|');
const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSeparator = (l: string) => isTableRow(l) && cells(l).every((c) => /^:?-{2,}:?$/.test(c));

export function LegalMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  const key = () => `b${blocks.length}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      const title = h[2].trim();
      const clause = level === 2 ? CLAUSE.exec(title) : null;
      const content = inline(title);
      if (level === 1) blocks.push(<h1 key={key()} className="text-title font-semibold">{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={key()} id={clause ? clause[1].toLowerCase() : undefined} className="mt-8 scroll-mt-4 text-lg font-semibold">{content}</h2>);
      else blocks.push(<h3 key={key()} className="mt-5 font-semibold">{content}</h3>);
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) { quote.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push(<blockquote key={key()} className="mt-4 rounded-md border border-orange bg-orange/10 p-3 text-sm text-ink">{inline(quote.join(' '))}</blockquote>);
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      blocks.push(
        <div key={key()} className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>{head.map((c, ci) => <th key={ci} scope="col" className="border border-border bg-bg px-2 py-1 font-semibold">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-border px-2 py-1 align-top">{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const ordered = OL.test(line);
    if (ordered || UL.test(line)) {
      const re = ordered ? OL : UL;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) { items.push(re.exec(lines[i])![1]); i++; }
      const li = items.map((it, ii) => <li key={ii}>{inline(it)}</li>);
      blocks.push(ordered
        ? <ol key={key()} className="mt-3 list-decimal space-y-1 pl-6">{li}</ol>
        : <ul key={key()} className="mt-3 list-disc space-y-1 pl-6">{li}</ul>);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !lines[i].startsWith('>') && !UL.test(lines[i]) && !OL.test(lines[i]) && !isTableRow(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(<p key={key()} className="mt-3">{inline(para.join(' '))}</p>);
  }

  return <div className="text-ink">{blocks}</div>;
}
