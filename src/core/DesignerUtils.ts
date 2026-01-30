import * as THREE from 'three';

export class HistoryManager {
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private maxHistory = 50;
    private onStateChange: (state: string) => void;

    constructor(initialState: string, onStateChange: (state: string) => void) {
        this.undoStack.push(initialState);
        this.onStateChange = onStateChange;
    }

    public push(state: string) {
        if (state === this.undoStack[this.undoStack.length - 1]) return;
        this.undoStack.push(state);
        this.redoStack = [];
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.updateButtons();
    }

    public undo() {
        if (this.undoStack.length <= 1) return;
        const current = this.undoStack.pop()!;
        this.redoStack.push(current);
        const previous = this.undoStack[this.undoStack.length - 1];
        this.onStateChange(previous);
        this.updateButtons();
    }

    public redo() {
        if (this.redoStack.length === 0) return;
        const next = this.redoStack.pop()!;
        this.undoStack.push(next);
        this.onStateChange(next);
        this.updateButtons();
    }

    private updateButtons() {
        const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
        const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
        if (undoBtn) undoBtn.disabled = this.undoStack.length <= 1;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }
}

export class DesignerUtils {
    public static safeStringify(obj: any, indent = 0): string {
        const spacing = "  ".repeat(indent);
        const nextSpacing = "  ".repeat(indent + 1);

        if (obj === null) return "null";
        if (obj === undefined) return "undefined";
        if (typeof obj === "boolean") return obj.toString();
        if (typeof obj === "string") return `"${obj}"`;
        if (typeof obj === "function") return obj.toString();

        if (typeof obj === "number") {
            // Hex color formatting for values > 255 (heuristically colors)
            if (obj > 0xff) {
                return `0x${obj.toString(16).padStart(6, '0')}`;
            }
            return obj.toString();
        }

        if (obj instanceof THREE.Vector3) {
            return `new THREE.Vector3(${obj.x}, ${obj.y}, ${obj.z})`;
        }

        if (Array.isArray(obj)) {
            if (obj.length === 0) return "[]";
            const items = obj.map(item => this.safeStringify(item, indent + 1));
            return `[\n${nextSpacing}${items.join(`,\n${nextSpacing}`)}\n${spacing}]`;
        }

        if (typeof obj === "object") {
            // Check for Vector3-like objects
            if (obj.x !== undefined && obj.y !== undefined && obj.z !== undefined && Object.keys(obj).length === 3) {
                return `new THREE.Vector3(${obj.x}, ${obj.y}, ${obj.z})`;
            }

            const keys = Object.keys(obj);
            if (keys.length === 0) return "{}";

            const lines = keys.map(key => {
                const value = obj[key];
                const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
                let formattedValue = this.safeStringify(value, indent + 1);

                // Ensure colors in visuals are hex formatted even if small
                if (typeof value === "number" && key.toLowerCase().includes("color")) {
                    formattedValue = `0x${value.toString(16).padStart(6, '0')}`;
                }

                return `${formattedKey}: ${formattedValue}`;
            });

            return `{\n${nextSpacing}${lines.join(`,\n${nextSpacing}`)}\n${spacing}}`;
        }

        return String(obj);
    }

    public static parseConfig(text: string, THREE_CONTEXT: any): any {
        try {
            // provide THREE to the evaluation context
            const parsed = new Function('THREE', 'return ' + text)(THREE_CONTEXT);
            return parsed;
        } catch (e: any) {
            throw new Error("Parse Error: " + e.message);
        }
    }
}
