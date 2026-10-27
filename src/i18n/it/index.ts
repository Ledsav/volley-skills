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
import { legal } from './legal';
import { platform } from './platform';
import { settings } from './settings';
import { signup } from './signup';
import { teams } from './teams';
import { theme } from './theme';

export const it = { admin, auth, clubs, common, components, home, interest, labels, legal, layout, platform, settings, signup, teams, theme } satisfies Catalog;
