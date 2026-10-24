// Minimum releases containing the CVE-2026-111497 fix. Keep in sync with engines.node.
const minimumVersions = new Map([
  [22, [23, 4]],
  [24, [22, 1]],
  [26, [12, 1]],
]);

export function assertSupportedNodeVersion(version = process.versions.node) {
  const [major, minor, patch] = version.split('.').map(Number);
  const minimum = minimumVersions.get(major);
  if (minimum && (minor > minimum[0] || (minor === minimum[0] && patch >= minimum[1]))) {
    return;
  }
  throw new Error(
    `Unsupported Node.js ${version}. SourcePrinter requires Node.js 22.23.4+, 24.22.1+, or 26.12.1+ within those major versions (CVE-2026-111497). Upgrade Node.js and restart the service.`,
  );
}
