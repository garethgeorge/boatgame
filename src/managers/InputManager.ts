export type InputAction = 'forward' | 'backward' | 'left' | 'right' | 'stop' | 'viewMode' | 'debug' | 'debugProfiler' | 'debugConsole' | 'paused' | 'skipBiome';

export class InputManager {
    // State tracked directly from event listeners
    private liveActions: Set<InputAction> = new Set();

    // State snapshots for the current and previous frames
    private currentActions: Set<InputAction> = new Set();
    private previousActions: Set<InputAction> = new Set();

    // Configuration
    private isPaused: boolean = false;

    // Analog inputs (not boolean)
    public tilt: number = 0; // -1.0 to 1.0


    constructor() {
        this.init();
    }

    public setOptions(options: { paused?: boolean }) {
        if (options.paused !== undefined) {
            this.isPaused = options.paused;
            if (this.isPaused) {
                // Clear inputs when paused
                this.liveActions.clear();
                this.currentActions.clear();
                this.previousActions.clear();
                this.previousActions.clear();
                this.tilt = 0;
            }
        }
    }

    init() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Accelerometer support
        window.addEventListener('deviceorientation', (e) => this.onDeviceOrientation(e));
    }

    public update() {
        if (this.isPaused) return;

        // Snapshot state for this frame
        this.previousActions = new Set(this.currentActions);
        this.currentActions = new Set(this.liveActions);
    }

    public isDown(action: InputAction): boolean {
        return this.currentActions.has(action);
    }

    public wasPressed(action: InputAction): boolean {
        return this.currentActions.has(action) && !this.previousActions.has(action);
    }

    public wasReleased(action: InputAction): boolean {
        return !this.currentActions.has(action) && this.previousActions.has(action);
    }

    async requestPermission(): Promise<boolean> {
        // iOS 13+ requires permission
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            try {
                const response = await (DeviceOrientationEvent as any).requestPermission();
                return response === 'granted';
            } catch (e) {
                console.error("Permission request failed", e);
                return false;
            }
        }
        return true; // Non-iOS or older devices don't need permission
    }

    onDeviceOrientation(e: DeviceOrientationEvent) {
        if (this.isPaused) return;

        // Gamma is usually left/right tilt (-90 to 90)
        // We want to map this to -1 to 1
        // Holding phone in landscape:
        // Beta is tilt front/back (-180 to 180)
        // Gamma is tilt left/right (-90 to 90)

        // Let's assume Landscape mode.
        // If user holds phone in landscape, tilting left/right corresponds to Beta?
        // Actually, it depends on orientation.
        // Let's use a simple heuristic or just Gamma for now (Portrait) and Beta (Landscape)?
        // Most browser games lock to landscape.
        // In Landscape, tilting left/right (steering) is Beta.

        let tilt = 0;

        // Check orientation
        const orientation = window.screen.orientation ? window.screen.orientation.type : window.orientation;

        if (typeof orientation === 'string' && orientation.includes('landscape')) {
            // Landscape: Beta is tilt
            // Beta range: -180 to 180.
            // Center is 0?
            // Tilting left (top goes down) -> Beta negative?
            // Let's clamp to -45 to 45 degrees for full steering
            if (e.beta !== null) {
                tilt = Math.max(-45, Math.min(45, e.beta)) / 45;
                // Invert if needed based on testing. 
                // Usually tilting left (left side down) is negative beta?
            }
        } else {
            // Portrait: Gamma is tilt
            if (e.gamma !== null) {
                tilt = Math.max(-45, Math.min(45, e.gamma)) / 45;
            }
        }

        this.tilt = tilt;
    }

    onKeyDown(e: KeyboardEvent) {
        if (this.isPaused) return;

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.liveActions.add('forward');
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.liveActions.add('backward');
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.liveActions.add('left');
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.liveActions.add('right');
                break;
            case 'KeyX':
                this.liveActions.add('stop');
                break;
            case 'KeyV':
                this.liveActions.add('viewMode');
                break;
            case 'KeyZ':
                if (e.shiftKey) {
                    this.liveActions.add('debugProfiler');
                } else {
                    this.liveActions.add('debug');
                }
                break;
            case 'KeyC':
                this.liveActions.add('debugConsole');
                break;
            case 'Space':
                this.liveActions.add('paused');
                e.preventDefault(); // Prevent scrolling
                break;
            case 'KeyB':
                this.liveActions.add('skipBiome');
                break;
        }
    }

    onKeyUp(e: KeyboardEvent) {
        if (this.isPaused) return;

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.liveActions.delete('forward');
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.liveActions.delete('backward');
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.liveActions.delete('left');
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.liveActions.delete('right');
                break;
            case 'KeyX':
                this.liveActions.delete('stop');
                break;
            case 'KeyV':
                this.liveActions.delete('viewMode');
                break;
            case 'KeyZ':
                this.liveActions.delete('debug');
                this.liveActions.delete('debugProfiler');
                break;
            case 'KeyC':
                this.liveActions.delete('debugConsole');
                break;
            case 'Space':
                this.liveActions.delete('paused');
                break;
            case 'KeyB':
                this.liveActions.delete('skipBiome');
                break;
        }
    }
}
