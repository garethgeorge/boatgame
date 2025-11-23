export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        // TODO: Add accelerometer support
    }

    onKeyDown(e) {
        switch(e.code) {
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
        }
    }

    onKeyUp(e) {
        switch(e.code) {
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

    getState() {
        return { ...this.keys };
    }
}
