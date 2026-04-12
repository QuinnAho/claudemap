import http from 'http'
import path from 'path'
import { exec, spawn } from 'child_process'
import { fileURLToPath } from 'url'

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function spawnDevServer(appDir) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev'], {
      cwd: appDir,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
  }

  return spawn(npmCommand(), ['run', 'dev'], {
    cwd: appDir,
    detached: true,
    stdio: 'ignore',
  })
}

export function isClaudeMapAppRunning(url = 'http://127.0.0.1:5173') {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve(response.statusCode >= 200 && response.statusCode < 500)
    })

    request.on('error', () => resolve(false))
    request.setTimeout(1500, () => {
      request.destroy()
      resolve(false)
    })
  })
}

async function waitForClaudeMapApp(url, timeoutMs = 20000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await isClaudeMapAppRunning(url)) {
      return true
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 700)
    })
  }

  return false
}

function openBrowserForUrl(url) {
  return new Promise((resolve) => {
    let command = null

    if (process.platform === 'darwin') {
      command = `open "${url}"`
    } else if (process.platform === 'win32') {
      command = `start "" "${url}"`
    } else {
      command = `xdg-open "${url}"`
    }

    exec(command, (error) => {
      resolve(!error)
    })
  })
}

export async function launchClaudeMapWindow(options = {}) {
  const url = options.url || 'http://127.0.0.1:5173'
  const running = await isClaudeMapAppRunning(url)

  if (running || !options.startIfNeeded) {
    const openedBrowser = running && options.openBrowser ? await openBrowserForUrl(url) : false

    return {
      running,
      started: false,
      openedBrowser,
      ready: running,
      url,
    }
  }

  const appDir = path.resolve(fileURLToPath(new URL('../../app', import.meta.url)))
  const serverProcess = spawnDevServer(appDir)

  serverProcess.unref()
  const ready = await waitForClaudeMapApp(url)
  const openedBrowser = ready && options.openBrowser ? await openBrowserForUrl(url) : false

  return {
    running: false,
    started: true,
    openedBrowser,
    ready,
    url,
  }
}
