import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The app code lives inside a read-only asar archive, so the user's API keys
// must come from a writable location. Load them from <userData>/.env
// (e.g. ~/.config/theos/.env on Linux) BEFORE server.js is imported, because
// server.js reads process.env.*_API_KEY at module-load time.
const userEnvPath = path.join(app.getPath('userData'), '.env');
dotenv.config({ path: userEnvPath });

let mainWindow;
let serverPort = null;

async function createWindow() {
  if (!serverPort) {
    try {
      const { startServer } = await import('./server.js');
      serverPort = await startServer();
    } catch (err) {
      dialog.showErrorBox(
        'Error de configuración',
        `${err.message}\n\nCrea un archivo .env en:\n${userEnvPath}\n\nEjemplo:\nANTHROPIC_API_KEY=sk-ant-...`
      );
      app.quit();
      return;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    title: 'Theos',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  try {
    await mainWindow.loadURL(`http://localhost:${serverPort}`);
  } catch (err) {
    dialog.showErrorBox(
      'Error al cargar Theos',
      `No se pudo cargar la interfaz en http://localhost:${serverPort}\n\n${err.message}`
    );
    app.quit();
    return;
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow).catch((err) => {
  dialog.showErrorBox('Error al iniciar Theos', err?.message || String(err));
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
