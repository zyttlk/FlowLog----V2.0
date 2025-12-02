const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // 1. 创建浏览器窗口
  const win = new BrowserWindow({
    width: 1200, 
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      // 开启 Node.js 集成，允许在 React 中直接使用 fs (文件系统) 模块
      nodeIntegration: true,
      contextIsolation: false, 
      webSecurity: false // 允许加载本地资源
    },
    autoHideMenuBar: true, // 隐藏菜单栏
    // icon: path.join(__dirname, 'public/favicon.ico') 
     icon: path.join(__dirname, 'public/favicon.ico') 
  });

  // 2. 加载应用
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // 开发环境：加载 localhost
    win.loadURL('http://localhost:3000');
  } else {
    // 生产环境：加载本地文件
    win.loadFile(path.join(__dirname, 'dist/index.html'));
    // 让打包后的软件里也能看到控制台
    // win.webContents.openDevTools(); 
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});