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
    'terms/en': '382cbcc125a69734a1a35332df9b081a41a3b09ee1289d7f59460a32c396909d',
    'terms/it': 'b970ec2786931b1d1162a5d01ab9851d67799b3d37093a6c29c8283eca30060b',
    'terms/fr': '28d2cec3db4a4e33ae148e17395984dc61825991d150db321e0a07815718ad9b',
    'terms/de': '6fb9ec974942988c18fa77911615d288c53c111519fbb797debb6ae4c453c985',
    'terms/es': '4fdd23e8df968ccbb24340ddee9f5c3f8d08a634be909d3accb010516ca482d0',
    'dpa/en': '906931a56700499ca06b105afce9eb49efccf636bdab85516c494da076cdba0a',
    'dpa/it': 'f37ffc818a4ca3b984de4435cc0a601645dfc14933879fc4672cfa3d14abf9df',
    'dpa/fr': '7e64c3f92df3beddb8f8626941cf53715276ce342e78e30f60bba9c2041da86e',
    'dpa/de': '746fe2bd665f94eaee1f5379f1a2df6a4c15cb4974e3aa356903434792264cae',
    'dpa/es': 'fcf1c7420b4793e41ef6d43b55407255b99955c337a994ba9e51be21a611eef8',
    'subprocessors/en': 'ad0daec0d794165b1224922fe958371cffe5bca51c1dae1ca8b44551a7038bc8',
    'subprocessors/it': 'a96709fae7a6c1b455a8de81876fa812fdb927b04b1ea9c0261fd7717b7382cc',
    'subprocessors/fr': '0b18d44ffff4bdabc2f8577c6ad18dd1660377d519363f77a36cdb968b516e85',
    'subprocessors/de': '8bb1012401ed7aab70546df12ff8606e3e37fa6a7ab2696faa6adc33ea07ec5e',
    'subprocessors/es': '33987d21c16d5807aff76f9cee68a4ae3899802652527f66a33e621b69ca790f',
    'privacy/en': '11f84c450bd98da4fc9b3279d819eaa7585e900f2b558ea369d4ce6220ea8bc7',
    'privacy/it': 'f2753f8e40217cf2be3cec85601d1e8e50cdbe59c6544538706305288ff473af',
    'privacy/fr': 'cdc06bcc1b0eadc08155eeb75dc14df333108d88f43b8d667f9a2722a79110f6',
    'privacy/de': 'e795b919667033027b8340040982d996ccca5a7ef2e3a19284686335d1953b18',
    'privacy/es': '3c38e23052550df2cb365a3d70c6a245ea4dafd1b6a0bd308c834076ce69e396',
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
