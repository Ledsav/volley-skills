import type { Catalog } from '../catalog';
import { admin } from './admin';
import { components } from './components';
import { auth } from './auth';
import { clubs } from './clubs';
import { common } from './common';
import { home } from './home';
import { layout } from './layout';
import { interest } from './interest';
import { labels } from './labels';
import { settings } from './settings';
import { teams } from './teams';
import { theme } from './theme';

export const it = { admin, auth, clubs, common, components, home, interest, labels, layout, settings, teams, theme } satisfies Catalog;
