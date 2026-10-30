/**
 * Pre-publish guard: refuse to publish while package.json still carries a
 * placeholder, so a broken repository link never reaches the registry.
 */
import { readFileSync } from 'node:fs'

const text = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
if (text.includes('GITHUB_USER')) {
  console.error('check-release: package.json still contains the GITHUB_USER placeholder.\n' +
    'Replace it with your GitHub user name (repository / bugs / homepage) before publishing.')
  process.exit(1)
}
const pkg = JSON.parse(text)
if (pkg.name !== 'dsh-prompt-booster') {
  console.error(`check-release: unexpected package name ${pkg.name}`)
  process.exit(1)
}
console.log(`check-release: ${pkg.name}@${pkg.version} ok`)
