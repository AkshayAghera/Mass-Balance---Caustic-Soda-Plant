const { app, BrowserWindow, screen, Menu, dialog, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// 1. Configure Logging
// Logs are stored in: %AppData%/mass-balance-csp/logs/main.log
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
    show: false, // Hidden until update check is done
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

  // Trigger GitHub Update check only if app is packed
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    // In Dev Mode, skip update and show main window after 3 seconds
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) splash.close();
      if (mainWindow) {
        mainWindow.maximize();
        mainWindow.show();
      }
    }, 3000);
  }
});

// --- Auto-Updater Events ---

autoUpdater.on('update-available', () => {
  log.info("Update available found on GitHub.");
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('update_available');
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log.info(log_message);

  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('download-percentage', Math.floor(progressObj.percent));
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info("Update downloaded. Version: " + info.version);
  
  // Close splash and show main window before the dialog
  if (splash && !splash.isDestroyed()) splash.close();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.maximize();
    mainWindow.show();
  }

  // Final confirmation to user
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `A new version (${info.version}) has been downloaded.`,
    detail: 'The application will restart to apply the update.',
    buttons: ['Restart and Install Now', 'Later'],
    defaultId: 0
  }).then((result) => {
    if (result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });
});

autoUpdater.on('update-not-available', () => {
  log.info("No updates available.");
  setTimeout(() => {
    if (splash && !splash.isDestroyed()) splash.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
      mainWindow.show();
    }
  }, 3000);
});

autoUpdater.on('error', (err) => {
  log.error("Update Error: " + err);
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