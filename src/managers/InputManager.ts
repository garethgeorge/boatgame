export interface InputState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    viewMode: 'close' | 'far';
    debug: boolean;
    paused: boolean;
    tilt: number; // -1.0 to 1.0 (Left to Right)
}

export class InputManager {
    keys: InputState;

    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            viewMode: 'close',
            debug: false,
            paused: false,
            tilt: 0
        };

        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Accelerometer support
        window.addEventListener('deviceorientation', (e) => this.onDeviceOrientation(e));
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

        // Update state
        this.keys.tilt = tilt;
    }

    onKeyDown(e: KeyboardEvent) {
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.forward = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.backward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = true;
                break;
            case 'KeyV':
                this.keys.viewMode = this.keys.viewMode === 'close' ? 'far' : 'close';
                break;
            case 'KeyZ':
                this.keys.debug = !this.keys.debug;
                break;
            case 'Space':
                this.keys.paused = !this.keys.paused;
                e.preventDefault(); // Prevent scrolling
                break;
        }
    }

    onKeyUp(e: KeyboardEvent) {
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.forward = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.backward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = false;
                break;
        }
    }

    getState(): InputState {
        return { ...this.keys };
    }
}
