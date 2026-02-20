const { app, BrowserWindow, screen, Menu, dialog, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// 1. Configure Logging FIRST (Must be after app is defined)
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

let splash;
let mainWindow;

function createSplash() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  splash = new BrowserWindow({
    width: width,
    height: height,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    show: false,
    backgroundColor: "#0f172a",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      contextIsolation: false, // Required for IPC in splash
      nodeIntegration: true    
    }
  });

  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.once("ready-to-show", () => splash.show());
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createSplash();
  createMainWindow();

  // Trigger GitHub Update check
  autoUpdater.checkForUpdatesAndNotify();
});

// --- Auto-Updater Events ---
autoUpdater.on('update-available', () => {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('update_available');
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('download-percentage', Math.floor(progressObj.percent));
  }
});

autoUpdater.on('update-downloaded', (info) => {
  // Logic to handle completed download
  if (splash && !splash.isDestroyed()) splash.close();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();

  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} has been downloaded. Restart to install?`,
    buttons: ['Restart Now', 'Later'],
    defaultId: 0
  }).then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  console.error("Update Error: ", err);
  setTimeout(() => {
    if (splash && !splash.isDestroyed()) splash.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
       mainWindow.maximize();
       mainWindow.show();
    }
  }, 3000);
});

autoUpdater.on('update-not-available', () => {
  setTimeout(() => {
    if (splash && !splash.isDestroyed()) splash.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
       mainWindow.maximize();
       mainWindow.show();
    }
  }, 3000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});