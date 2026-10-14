import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// 1100+ component tests run in parallel; a page that loads in 50 ms alone can take
// over the 1 s default to settle on a busy machine. Passing waits return at once.
configure({ asyncUtilTimeout: 4000 });
