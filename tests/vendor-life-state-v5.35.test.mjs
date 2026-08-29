import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyLifeStateVendor } from '../scripts/verify-life-state-v5.35.mjs';

test('ver5.35 frozen JSON, regex and extracted JS retain their recorded bytes', () => {
  const provenance = verifyLifeStateVendor();
  assert.equal(provenance.extraction.transformations.length, 0);
  assert.equal(provenance.extraction.newlineAppended, false);
  assert.equal(provenance.vendored.json.sha256, provenance.source.json.sha256);
  assert.equal(provenance.vendored.regex.sha256, provenance.source.regex.sha256);
});
