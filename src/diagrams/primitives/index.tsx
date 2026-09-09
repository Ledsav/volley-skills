import type { DiagramItem } from '../../types/diagram';
import { PlayerToken } from './PlayerToken';
import { Ball } from './Ball';
import { Cone } from './Cone';
import { Ladder } from './Ladder';
import { Net } from './Net';
import { Pole } from './Pole';
import { Line } from './Line';
import { Arrow } from './Arrow';
import { TextLabel } from './TextLabel';
import { ZoneLabel } from './ZoneLabel';

export function renderItem(item: DiagramItem) {
  switch (item.type) {
    case 'player': return <PlayerToken key={item.id} item={item} />;
    case 'ball': return <Ball key={item.id} item={item} />;
    case 'cone': return <Cone key={item.id} item={item} />;
    case 'ladder': return <Ladder key={item.id} item={item} />;
    case 'net': return <Net key={item.id} item={item} />;
    case 'pole': return <Pole key={item.id} item={item} />;
    case 'line': return <Line key={item.id} item={item} />;
    case 'arrow': return <Arrow key={item.id} item={item} />;
    case 'text': return <TextLabel key={item.id} item={item} />;
    case 'zoneLabel': return <ZoneLabel key={item.id} item={item} />;
  }
}
