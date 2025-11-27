export interface InputState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    viewMode: 'close' | 'far';
    debug: boolean;
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
            debug: false
        };

        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        // TODO: Add accelerometer support
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
