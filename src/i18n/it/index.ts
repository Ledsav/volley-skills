import type { Catalog } from '../catalog';
import { common } from './common';
import { layout } from './layout';
import { labels } from './labels';
import { settings } from './settings';
import { teams } from './teams';

export const it = { common, labels, layout, settings, teams } satisfies Catalog;
