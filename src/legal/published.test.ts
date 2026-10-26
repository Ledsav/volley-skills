// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';
import { legalText } from './legalDocs';
import { LEGAL_LANGS, type LegalDocId } from './versions';

/**
 * SHA-256 of every published text as shown and signed (placeholders filled).
 * A change here means the published text changed: ship a new version id instead
 * (texts are kept forever for hash re-verification). The only exception is before the first
 * production acceptance (docs/PRODUCTION-READINESS.md section E): until then the pins may be
 * updated in place, e.g. when the operator address is filled in.
 */
const PUBLISHED: Record<string, Record<string, string>> = {
  '2026-10-22': {
    'terms/en': '313e124655df029367dc4acc3811b324523ec3da2347d0e3e6b6b38dedf7e983',
    'terms/it': '91cdaf47987eb7ec202017e8a37da85b92127dc50cbbc2d4ca3cb77225c47754',
    'terms/fr': '0cfcab05f613aa7f84cc1f8be83ee70337af952df9603e9c84f4ab3017dfe8c0',
    'terms/de': '911c59673f8141fbd5aadb22b2231529ac065a91ce1e862e7cd6ab3495e4dbac',
    'terms/es': '122cf2f3df9aa27d2d352443cc0c84432e1326723b4b6210efe2d53e18b4dfed',
    'dpa/en': '7008c422965865f765bd07c04f2d1c9f79599bef90e194e52dd250c48bd32d41',
    'dpa/it': '647858d57eb2ba090c42bd0b1220d1f0bc4b0f2cc97692065542550dae2daa12',
    'dpa/fr': '5cdab971e16a42736ad254cdcd2c0e730fcb28a396b1cb3aa865cbdf4218eeec',
    'dpa/de': 'c7646076e43cd088720cb109a844fa67ead1a9909ec66929a905a7aa123cb500',
    'dpa/es': 'da2a92810e7e4809c4ecba70665cb434dee964570abca45afbeb0308c51af331',
    'subprocessors/en': 'ad0daec0d794165b1224922fe958371cffe5bca51c1dae1ca8b44551a7038bc8',
    'subprocessors/it': 'a96709fae7a6c1b455a8de81876fa812fdb927b04b1ea9c0261fd7717b7382cc',
    'subprocessors/fr': '0b18d44ffff4bdabc2f8577c6ad18dd1660377d519363f77a36cdb968b516e85',
    'subprocessors/de': '8bb1012401ed7aab70546df12ff8606e3e37fa6a7ab2696faa6adc33ea07ec5e',
    'subprocessors/es': '33987d21c16d5807aff76f9cee68a4ae3899802652527f66a33e621b69ca790f',
    'privacy/en': 'deb6658a4e2bc9300154b59408d5c0001ce1c644d5eac72bbfaa4e0d1d2a1fdc',
    'privacy/it': 'e90f0848dfb12dca59fd7996048f62118eba22832c4c070f2bcb1a8e3c6eac93',
    'privacy/fr': '2e3b9cae167f217b8b90b7f09a1efe86ce634252cb53147c5eaa2e02fae209f9',
    'privacy/de': 'b2a4672f685eb66ab5f82e1354843933fdbc31d325ff39d6b3d003a8d9709b22',
    'privacy/es': 'fb2e17e01b67a4187f91f657151755a041df41300474a17dfef8ea89908c9181',
    'dpia-pack/en': 'c92113707481506375c1b9d3d0b8a84a7a6bf9cb394d3b9cda43d2e63b4fe977',
    'dpia-pack/it': 'b7759e16c2a09a130c8e55b9769724d9c899a0189d32b55c0b99c6211ca7dd10',
    'dpia-pack/fr': '82a50de00735a0ef09fa55cef98cba5e3b7ceb481681272551f5d1a20838f73b',
    'dpia-pack/de': '138df80cb19906efa38436280b7a321dd8b31a942fc7b0866c29d8208ed764e1',
    'dpia-pack/es': 'da170bf1c6077d863b961a9deb7c188eacdace7f1eb4f9b418437fbd7fe7c99d',
  },
};

const DOCS: LegalDocId[] = ['terms', 'dpa', 'subprocessors', 'privacy', 'dpia-pack'];

describe('published legal texts', () => {
  for (const [version, hashes] of Object.entries(PUBLISHED)) {
    it(`pins all ${DOCS.length * LEGAL_LANGS.length} texts of ${version}`, () => {
      expect(Object.keys(hashes)).toHaveLength(DOCS.length * LEGAL_LANGS.length);
    });
    for (const doc of DOCS) {
      for (const lang of LEGAL_LANGS) {
        it(`${doc} ${version} ${lang} is unchanged`, async () => {
          expect(await sha256Hex(legalText(doc, version, lang))).toBe(hashes[`${doc}/${lang}`]);
        });
      }
    }
  }
});
