import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSupportedNodeVersion } from '../server/runtime.js';

test('rejects releases before the Brotli security fix and unsupported major versions', () => {
  for (const version of ['20.20.0', '22.12.0', '22.23.3', '23.11.0', '24.22.0', '25.9.0', '26.10.0', '26.12.0', '27.0.0']) {
    assert.throws(() => assertSupportedNodeVersion(version), /CVE-2026-111497/, version);
  }
});

test('accepts fixed releases and subsequent updates in supported branches', () => {
  for (const version of ['22.23.4', '22.23.5', '22.24.0', '24.22.1', '24.23.0', '26.12.1', '26.13.0']) {
    assert.doesNotThrow(() => assertSupportedNodeVersion(version), version);
  }
});
