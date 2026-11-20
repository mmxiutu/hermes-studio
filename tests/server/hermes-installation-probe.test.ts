import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { probeHermesCliVersion } from '../../packages/server/src/modules/hermes/services/runtime/discovery'

const python = execFileSync(process.platform === 'win32' ? 'python' : 'python3', [
  '-c', 'import sys; print(sys.executable)',
], { encoding: 'utf8' }).trim()
const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function installation(options: { version?: string; bootstrap?: string; legacy?: boolean } = {}) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'studio-hermes-probe-')))
  directories.push(directory)
  const root = join(directory, "Hermes source 'with spaces'")
  const path = join(root, 'bin', 'hermes')
  function write(name: string, contents: string) {
    const file = join(root, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
  }
  write('bin/hermes', `#!/bin/sh\nexec "${python}" "$@"\n`)
  write('run_agent.py', '')
  write('cli.py', '')
  write('hermes_cli/__init__.py', `__version__ = ${JSON.stringify(options.legacy ? '0.21.3' : '0.0.0')}\n`)
  write('hermes_cli/main.py', '')
  if (!options.legacy) {
    write('pm/__init__.py', '')
    write('pm/identity.py', `VERSION = ${JSON.stringify(options.version ?? '0.23.1+3685.gb03df8f')}\n`)
    write('hermes_cli/version_info.py', [
      'from types import SimpleNamespace',
      'from pm.identity import VERSION',
      'def get_version_info(): return SimpleNamespace(display_version=VERSION)',
    ].join('\n'))
  }
  if (options.bootstrap !== undefined) write('hermes_bootstrap.py', options.bootstrap)
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    HOME: directory,
    USERPROFILE: directory,
    HERMES_HOME: join(directory, 'state'),
    HERMES_BIN: path,
    PYTHONNOUSERSITE: '1',
    PYTHONDONTWRITEBYTECODE: '1',
  }
  return { root, path, write, env }
}

describe('Hermes installation version probes', () => {
  it('imports canonical identity from the selected source root outside Studio cwd', async () => {
    const fixture = installation()
    const before = process.env.PYTHONPATH
    expect(await probeHermesCliVersion(fixture.path, fixture.env)).toEqual({
      version: '0.23.1+3685.gb03df8f', error: '',
    })
    expect(process.env.PYTHONPATH).toBe(before)
  })

  it('can import newly added top-level packages with an older partial editable install', async () => {
    const fixture = installation()
    fixture.write('old-editable/hermes_cli/__init__.py', `__path__ = [${JSON.stringify(join(fixture.root, 'hermes_cli'))}]\n`)
    const env = { ...fixture.env, PYTHONPATH: join(fixture.root, 'old-editable') }
    expect(await probeHermesCliVersion(fixture.path, env)).toEqual({ version: '0.23.1+3685.gb03df8f', error: '' })
  })

  it('reads identity without running launcher bootstrap that can repair or install dependencies', async () => {
    const fixture = installation({ bootstrap: "raise RuntimeError('bootstrap must not run during discovery')\n" })
    expect(await probeHermesCliVersion(fixture.path, fixture.env)).toEqual({ version: '0.23.1+3685.gb03df8f', error: '' })
  })

  it('still reads legacy versions when canonical identity and bootstrap are absent', async () => {
    const fixture = installation({ legacy: true })
    expect(await probeHermesCliVersion(fixture.path, fixture.env)).toEqual({ version: '0.21.3', error: '' })
  })

  it('rejects broken canonical identity dependencies instead of accepting the compatibility version', async () => {
    const fixture = installation()
    fixture.write('hermes_cli/version_info.py', 'import missing_hermes_dependency\n')
    const probe = await probeHermesCliVersion(fixture.path, fixture.env)
    expect(probe.version).toBe('')
    expect(probe.error).toContain('missing_hermes_dependency')
  })

  it.each(['0.0.0', 'unknown', ''])('rejects an unstamped canonical identity: %j', async version => {
    const fixture = installation({ version })
    expect((await probeHermesCliVersion(fixture.path, fixture.env)).version).toBe('')
  })

  it('does not probe a different ambient Hermes installation', async () => {
    const other = installation({ version: '9.9.9' })
    const selected = installation({ version: '0.23.1' })
    selected.env = { ...selected.env, PYTHONPATH: other.root }
    expect(await probeHermesCliVersion(selected.path, selected.env)).toEqual({ version: '0.23.1', error: '' })
  })
})
