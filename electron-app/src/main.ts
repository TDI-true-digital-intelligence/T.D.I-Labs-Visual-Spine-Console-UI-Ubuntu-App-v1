/**
 * main.ts — SPINE Console main process. X11 hardline (Electron-on-this-box law),
 * spawns the tail engine, streams entries to the renderer.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { TailProcess, findEngine } from './tail-process';
import { SpineEntry } from './spine-types';

let win: BrowserWindow | null = null;
let tailer: TailProcess | null = null;

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'SPINE Console',
    backgroundColor: '#0b0e14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'src', 'ui', 'index.html'));
  win.on('closed', () => {
    win = null;
  });
}

app.commandLine.appendSwitch('ozone-platform', 'x11');

app.whenReady().then(() => {
  const engine = findEngine();
  console.log(`[spine] engine: ${engine ?? 'journalctl fallback'}`);
  createWindow();

  tailer = new TailProcess(engine);
  tailer.on('entry', (e: SpineEntry) => {
    if (win && !win.isDestroyed()) win.webContents.send('spine:entry', e);
  });
  tailer.on('log', (l: string) => console.log(`[engine] ${l.trim()}`));
  tailer.on('exit', (code) => console.log(`[engine] exited ${code}`));
  tailer.start({ all: true });

  ipcMain.handle('spine:get-engine', () => engine);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  tailer?.stop();
  app.quit();
});
