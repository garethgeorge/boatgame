export class DebugConsole {
    private static messages: { type: string, text: string, time: string }[] = [];
    private static maxMessages = 1000;
    private static overlay: HTMLElement | null = null;
    private static isInitialized = false;
    private static originalConsole: any = {};

    public static init() {
        if (this.isInitialized) return;

        // Save original console methods
        this.originalConsole.log = console.log;
        this.originalConsole.warn = console.warn;
        this.originalConsole.error = console.error;
        this.originalConsole.info = console.info;

        // Override console methods
        console.log = (...args: any[]) => {
            this.addMessage('log', args);
            this.originalConsole.log.apply(console, args);
        };
        console.warn = (...args: any[]) => {
            this.addMessage('warn', args);
            this.originalConsole.warn.apply(console, args);
        };
        console.error = (...args: any[]) => {
            this.addMessage('error', args);
            this.originalConsole.error.apply(console, args);
        };
        console.info = (...args: any[]) => {
            this.addMessage('info', args);
            this.originalConsole.info.apply(console, args);
        };

        this.initOverlay();
        this.isInitialized = true;
    }

    private static initOverlay() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.id = 'debug-console-overlay';
        this.overlay.style.position = 'absolute';
        this.overlay.style.bottom = '10px';
        this.overlay.style.left = '10px';
        this.overlay.style.width = 'calc(100% - 20px)';
        this.overlay.style.maxHeight = '250px';
        this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.overlay.style.color = '#fff';
        this.overlay.style.fontFamily = 'monospace';
        this.overlay.style.fontSize = '12px';
        this.overlay.style.padding = '10px';
        this.overlay.style.overflowY = 'auto';
        this.overlay.style.zIndex = '2000';
        this.overlay.style.display = 'none';
        this.overlay.style.pointerEvents = 'auto'; // Allow scrolling
        this.overlay.style.borderRadius = '5px';
        this.overlay.style.boxSizing = 'border-box';
        this.overlay.style.touchAction = 'pan-y'; // Allow vertical scrolling
        this.overlay.style.overscrollBehavior = 'contain'; // Prevent body scroll

        // Stop event propagation to prevent game input interference
        const stopPropagation = (e: Event) => e.stopPropagation();
        this.overlay.addEventListener('mousedown', stopPropagation);
        this.overlay.addEventListener('touchstart', stopPropagation, { passive: true });
        this.overlay.addEventListener('mousemove', stopPropagation);
        this.overlay.addEventListener('touchmove', stopPropagation, { passive: true });
        this.overlay.addEventListener('mouseup', stopPropagation);
        this.overlay.addEventListener('touchend', stopPropagation);
        this.overlay.addEventListener('wheel', stopPropagation);

        // Header
        const header = document.createElement('div');
        header.innerHTML = '<strong>Debug Console</strong> (Press C to toggle)';
        header.style.borderBottom = '1px solid #444';
        header.style.marginBottom = '5px';
        header.style.paddingBottom = '5px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        this.overlay.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.id = 'debug-console-content';
        this.overlay.appendChild(content);

        document.body.appendChild(this.overlay);
    }

    public static setVisibility(visible: boolean) {
        if (!this.overlay) this.initOverlay();
        if (this.overlay) {
            this.overlay.style.display = visible ? 'block' : 'none';
            if (visible) {
                this.updateDisplay();
                // Scroll to bottom when shown
                this.overlay.scrollTop = this.overlay.scrollHeight;
            }
        }
    }

    public static isVisible(): boolean {
        return this.overlay ? this.overlay.style.display !== 'none' : false;
    }

    private static addMessage(type: string, args: any[]) {
        const text = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Circular Object]';
                }
            }
            return String(arg);
        }).join(' ');

        const time = new Date().toLocaleTimeString();
        this.messages.push({ type, text, time });

        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        if (this.isVisible()) {
            this.updateDisplay();
        }
    }

    private static updateDisplay() {
        const content = document.getElementById('debug-console-content');
        if (!content) return;

        content.innerHTML = this.messages.map(msg => {
            let color = '#fff';
            if (msg.type === 'warn') color = '#ff0';
            if (msg.type === 'error') color = '#f44';
            if (msg.type === 'info') color = '#4af';

            return `<div style="color: ${color}; margin-bottom: 2px;">
                <span style="color: #888;">[${msg.time}]</span> [${msg.type.toUpperCase()}] ${msg.text}
            </div>`;
        }).join('');

        // Auto-scroll to bottom
        if (this.overlay) {
            this.overlay.scrollTop = this.overlay.scrollHeight;
        }
    }
}
