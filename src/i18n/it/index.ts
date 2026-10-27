import type { Catalog } from '../catalog';
import { components } from './components';
import { common } from './common';
import { home } from './home';
import { layout } from './layout';
import { labels } from './labels';
import { settings } from './settings';
import { teams } from './teams';
import { theme } from './theme';

export const it = { common, components, home, labels, layout, settings, teams, theme } satisfies Catalog;
