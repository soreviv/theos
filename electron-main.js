import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
        `${err.message}\n\nCrea un archivo .env en:\n${__dirname}\n\nEjemplo:\nANTHROPIC_API_KEY=sk-ant-...`
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
  mainWindow.loadURL(`http://localhost:${serverPort}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
