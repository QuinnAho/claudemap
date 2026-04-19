import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// runtime-polling validates the source-level contract of useRuntimePolling
// without standing up a React renderer. The hook is a thin wrapper around
// setInterval + focus listener + cleanup, and the behavior we care about is
// that it keeps using window.setInterval (polling cadence), reacts to focus
// (resume after sleep), and tears both down on unmount. The shape of those
// calls is locked in with string-level assertions against the hook file.

const hookPath = fileURLToPath(new URL('./useRuntimePolling.js', import.meta.url))
const source = readFileSync(hookPath, 'utf8')

describe('useRuntimePolling source contract', () => {
  it('invokes the callback once on mount before starting the interval', () => {
    // callback() must appear before setInterval inside the effect body so the
    // first load does not wait a full polling period.
    const callbackIndex = source.indexOf('callback()')
    const intervalIndex = source.indexOf('setInterval')
    expect(callbackIndex).toBeGreaterThan(-1)
    expect(intervalIndex).toBeGreaterThan(-1)
    expect(callbackIndex).toBeLessThan(intervalIndex)
  })

  it('uses window.setInterval with the provided intervalMs', () => {
    expect(source).toMatch(/window\.setInterval\(callback, intervalMs\)/)
  })

  it('subscribes to window focus to refresh on tab resume', () => {
    expect(source).toMatch(/window\.addEventListener\(['"]focus['"], callback\)/)
  })

  it('cleans up both the interval and the focus listener on unmount', () => {
    expect(source).toMatch(/window\.clearInterval\(intervalId\)/)
    expect(source).toMatch(/window\.removeEventListener\(['"]focus['"], callback\)/)
  })

  it('lists callback and intervalMs as effect deps so updates rewire cleanly', () => {
    expect(source).toMatch(/\[callback, intervalMs\]/)
  })
})
