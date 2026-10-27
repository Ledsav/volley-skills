import type { Catalog } from '../catalog';
import { common } from './common';
import { labels } from './labels';
import { teams } from './teams';

export const it = { common, labels, teams } satisfies Catalog;
