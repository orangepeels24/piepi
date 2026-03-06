const { app, BrowserWindow, ipcMain } = require('electron');
const path  = require('path');
const { exec, spawn } = require('child_process');
const fs    = require('fs');

let mainWindow = null;
let splashWindow = null;

const storePath = () => path.join(app.getPath('userData'), 'piepi-store.json');
const cachePath = () => path.join(app.getPath('userData'), 'pypi-packages.json');

function loadStore() {
  try { return JSON.parse(fs.readFileSync(storePath(), 'utf8')); }
  catch { return { favorites: [], recents: [], tags: {}, history: [], selectedInterpreter: '' }; }
}
function saveStore(data) {
  try { fs.writeFileSync(storePath(), JSON.stringify(data, null, 2)); } catch {}
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 520, height: 400,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    webPreferences: { contextIsolation: true }
  });
  splashWindow.loadFile('splash.html');
  splashWindow.setIgnoreMouseEvents(false);
}

function createMain() {
  mainWindow = new BrowserWindow({
    width: 1320, height: 860,
    frame: false,
    show: false,
    backgroundColor: '#080808',
    minWidth: 980, minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      mainWindow.show();
    }, 3200);
  });
}

app.whenReady().then(() => {
  createSplash();
  createMain();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMain(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('win-close',    () => mainWindow?.close());

ipcMain.handle('store-get', ()       => loadStore());
ipcMain.handle('store-set', (_, d)   => { saveStore(d); return true; });

ipcMain.handle('cache-get', () => {
  try {
    const stat = fs.statSync(cachePath());
    if (Date.now() - stat.mtimeMs < 24 * 60 * 60 * 1000) {
      return JSON.parse(fs.readFileSync(cachePath(), 'utf8'));
    }
  } catch {}
  return null;
});
ipcMain.handle('cache-set', (_, data) => {
  try { fs.writeFileSync(cachePath(), JSON.stringify(data)); return true; }
  catch { return false; }
});

// pip install — standard (non-streaming)
ipcMain.handle('pip-install', (_, { packages, interpreter }) => {
  return new Promise(resolve => {
    const py  = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    const pkg = packages.map(p => `"${p}"`).join(' ');
    exec(`${py} -m pip install ${pkg}`, { timeout: 120000 }, (err, stdout, stderr) => {
      resolve({ success: !err, output: (stdout + stderr).trim(), error: err?.message ?? '' });
    });
  });
});

// pip install — streaming: pushes lines via IPC event
ipcMain.handle('pip-install-stream', (_, { packages, interpreter }) => {
  return new Promise(resolve => {
    const py   = interpreter || (process.platform === 'win32' ? 'python' : 'python3');
    const args = ['-m', 'pip', 'install', ...packages];
    const proc = spawn(py, args);
    let out = '';
    const push = d => {
      const line = d.toString();
      out += line;
      mainWindow?.webContents.send('stream-line', line);
    };
    proc.stdout.on('data', push);
    proc.stderr.on('data', push);
    proc.on('close', code => resolve({ success: code === 0, output: out.trim(), error: code !== 0 ? `Exit ${code}` : '' }));
  });
});

// pip list — returns [{name, version}, ...]
ipcMain.handle('pip-list', (_, { interpreter }) => {
  return new Promise(resolve => {
    const py = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    exec(`${py} -m pip list --format=json`, { timeout: 30000 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      try { resolve(JSON.parse(stdout.trim())); } catch { resolve([]); }
    });
  });
});

// pip uninstall
ipcMain.handle('pip-uninstall', (_, { packages, interpreter }) => {
  return new Promise(resolve => {
    const py  = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    const pkg = packages.map(p => `"${p}"`).join(' ');
    exec(`${py} -m pip uninstall -y ${pkg}`, { timeout: 60000 }, (err, stdout, stderr) => {
      resolve({ success: !err, output: (stdout + stderr).trim(), error: err?.message ?? '' });
    });
  });
});

// pip outdated — returns [{name, version, latest_version}, ...]
ipcMain.handle('pip-outdated', (_, { interpreter }) => {
  return new Promise(resolve => {
    const py = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    exec(`${py} -m pip list --outdated --format=json`, { timeout: 60000 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      try { resolve(JSON.parse(stdout.trim())); } catch { resolve([]); }
    });
  });
});

// pip show — for "why installed" / orphan detection
ipcMain.handle('pip-show', (_, { package: pkg, interpreter }) => {
  return new Promise(resolve => {
    const py = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    exec(`${py} -m pip show "${pkg}"`, { timeout: 15000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const result = {};
      stdout.trim().split('\n').forEach(line => {
        const idx = line.indexOf(': ');
        if (idx !== -1) result[line.slice(0, idx).toLowerCase().replace(/-/g, '_')] = line.slice(idx + 2);
      });
      resolve(result);
    });
  });
});

// pip cache info
ipcMain.handle('pip-cache-info', (_, { interpreter }) => {
  return new Promise(resolve => {
    const py = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    exec(`${py} -m pip cache info`, { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ output: err ? (stderr || 'Cache info unavailable.') : stdout.trim() });
    });
  });
});

// pip cache purge
ipcMain.handle('pip-cache-purge', (_, { interpreter }) => {
  return new Promise(resolve => {
    const py = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    exec(`${py} -m pip cache purge`, { timeout: 30000 }, (err, stdout, stderr) => {
      resolve({ success: !err, output: (stdout + stderr).trim() });
    });
  });
});

ipcMain.handle('get-interpreters', () => {
  return new Promise(resolve => {
    const isWin = process.platform === 'win32';
    const cmds  = isWin
      ? ['where python', 'where python3']
      : ['which python3', 'which python', 'which python3.12', 'which python3.11', 'which python3.10'];
    const found = new Set();
    let done = 0;
    cmds.forEach(cmd => {
      exec(cmd, (err, out) => {
        if (!err) out.trim().split(/\r?\n/).forEach(p => p && found.add(p.trim()));
        if (++done === cmds.length) resolve([...found]);
      });
    });
  });
});

// Create venv
ipcMain.handle('venv-create', (_, { name, interpreter }) => {
  return new Promise(resolve => {
    const py = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    const venvPath = path.join(app.getPath('userData'), 'venvs', name);
    exec(`${py} -m venv "${venvPath}"`, { timeout: 60000 }, (err, stdout, stderr) => {
      const binPy = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python');
      resolve({ success: !err, path: binPy, output: (stdout + stderr).trim(), error: err?.message ?? '' });
    });
  });
});

// pip check (conflict detection)
ipcMain.handle('pip-check', (_, { interpreter }) => {
  return new Promise(resolve => {
    const py = interpreter ? `"${interpreter}"` : (process.platform === 'win32' ? 'python' : 'python3');
    exec(`${py} -m pip check`, { timeout: 60000 }, (err, stdout, stderr) => {
      resolve({ output: (stdout + stderr).trim(), hasConflicts: !!(stdout + stderr).trim() && err !== null });
    });
  });
});