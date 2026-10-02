import { contextBridge, ipcRenderer } from "electron";
import { createBridge } from "./bridge.ts";

// The preload (ADR 0007): sandboxed, bundled into one CommonJS file; it exposes only the typed bridge.
contextBridge.exposeInMainWorld("autoai", createBridge(ipcRenderer));
