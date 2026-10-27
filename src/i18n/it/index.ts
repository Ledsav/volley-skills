import type { Catalog } from '../catalog';
import { common } from './common';
import { home } from './home';
import { layout } from './layout';
import { labels } from './labels';
import { settings } from './settings';
import { teams } from './teams';

export const it = { common, home, labels, layout, settings, teams } satisfies Catalog;
