import type { Catalog } from '../catalog';
import { common } from './common';
import { home } from './home';
import { layout } from './layout';
import { labels } from './labels';
import { settings } from './settings';
import { teams } from './teams';
import { theme } from './theme';


export const it = { common, home, labels, layout, settings, teams, theme } satisfies Catalog;
