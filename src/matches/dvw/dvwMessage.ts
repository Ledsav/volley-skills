import type { Catalog } from '../../i18n/catalog';
import type { DvwMessage } from './types';

/** Words an import message (parse error or warning, mapping issue) in the active language. */
export function dvwMessageText(m: DvwMessage, t: Pick<Catalog, 'dvw' | 'labels'>): string {
  const x = t.dvw.messages;
  switch (m.code) {
    case 'notDvw':
      return x.notDvw;
    case 'unsupportedRegulation':
      return x.unsupportedRegulation;
    case 'noRallies':
      return x.noRallies;
    case 'playerNoJersey':
      return x.playerNoJersey(m.line);
    case 'setNumberMismatch':
      return x.setNumberMismatch(m.set, m.lines);
    case 'sameAppPlayer':
      return x.sameAppPlayer(m.first, m.second);
    case 'tooManyLiberos':
      return x.tooManyLiberos;
    case 'liberoReplaces':
      return x.liberoReplaces(m.jerseys);
    case 'liberoNeverOnCourt':
      return x.liberoNeverOnCourt;
    case 'startersUnmapped':
      return x.startersUnmapped(m.set);
    case 'tooLong':
      return x.tooLong;
    case 'unlistedJersey':
      return x.unlistedJersey(m.jersey, m.line);
    case 'droppedGrade':
      return x.droppedGrade(t.labels.skill[m.skill], m.grade, m.lines);
    case 'droppedUnknownPlayer':
      return x.droppedUnknownPlayer(m.lines);
    case 'droppedForJersey':
      return x.droppedForJersey(m.reason, m.jersey, m.lines);
    case 'subUnmapped':
      return x.subUnmapped(m.line, m.out, m.in);
    case 'endedOtherWay':
      return x.endedOtherWay(m.line, m.pointLine, m.winner);
    case 'scoreDiffers':
      return x.scoreDiffers;
  }
}
