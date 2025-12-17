export class GameThrottle {
    private container: HTMLElement;
    private thumb: HTMLElement;
    private isDragging: boolean = false;
    private getThrottleCallback: () => number;
    private setThrottleCallback: (value: number) => void;
    private isPausedCallback: () => boolean;

    // Relative Touch State
    private readonly DEADZONE_THRESHOLD = 0.1;

    private isTouchingGlobal: boolean = false;
    private touchStartY: number | null = null;
    private touchStartVirtualThrottle: number = 0;

    constructor(
        containerId: string,
        thumbId: string,
        setThrottleCallback: (value: number) => void,
        getThrottleCallback: () => number,
        isPausedCallback: () => boolean
    ) {
        this.container = document.getElementById(containerId) as HTMLElement;
        this.thumb = document.getElementById(thumbId) as HTMLElement;
        this.setThrottleCallback = setThrottleCallback;
        this.getThrottleCallback = getThrottleCallback;
        this.isPausedCallback = isPausedCallback;

        this.setupControls();
    }

    public updateVisuals(throttleValue: number) {
        // Map throttle (-1 to 1) to CSS top % (0% to 100%)
        // Throttle 1.0 (Full Forward) -> Top 0%
        // Throttle -1.0 (Full Reverse) -> Top 100%
        const ratio = (1.0 - throttleValue) / 2.0;
        this.thumb.style.top = `calc(20px + (100% - 40px) * ${ratio})`;
    }

    private setupControls() {
        // --- Slider Absolute Drag Controls ---
        const startSliderDrag = (e: MouseEvent | TouchEvent) => {
            if (this.isPausedCallback()) return;
            this.isDragging = true;
            this.updateThrottleFromSlider(e);
            e.preventDefault();
            e.stopPropagation(); // Stop propagation to prevent global touch logic
        };

        const moveSliderDrag = (e: MouseEvent | TouchEvent) => {
            if (this.isDragging) {
                this.updateThrottleFromSlider(e);
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const endSliderDrag = () => {
            this.isDragging = false;
        };

        // Attach listeners to slider container
        this.container.addEventListener('mousedown', startSliderDrag);
        this.container.addEventListener('touchstart', startSliderDrag, { passive: false });

        window.addEventListener('mousemove', moveSliderDrag);
        window.addEventListener('touchmove', moveSliderDrag, { passive: false });

        window.addEventListener('mouseup', endSliderDrag);
        window.addEventListener('touchend', endSliderDrag);


        // --- Global Relative Touch Controls ---
        const startGlobalTouch = (e: TouchEvent) => {
            if (this.isPausedCallback() || this.isDragging) return;

            // Ignore if touching UI elements (like instructions)
            const target = e.target as HTMLElement;
            if (target && target.closest && target.closest('#instructions-overlay')) {
                return;
            }

            if (e.touches.length > 0) {
                this.isTouchingGlobal = true;
                this.touchStartY = e.touches[0].clientY;
                const currentThrottle = this.getThrottleCallback();
                this.touchStartVirtualThrottle = this.inverseDeadzone(currentThrottle);
            }
        };

        const moveGlobalTouch = (e: TouchEvent) => {
            if (!this.isTouchingGlobal || this.isPausedCallback() || this.isDragging) return;

            // Ignore if touching UI elements
            const target = e.target as HTMLElement;
            if (target && target.closest && target.closest('#instructions-overlay')) {
                return;
            }

            if (this.touchStartY !== null && e.touches.length > 0) {
                const currentY = e.touches[0].clientY;
                const deltaY = this.touchStartY - currentY; // Up is positive

                // Map delta to throttle change
                // 150px drag = full throttle range (1.0)
                const range = 150;
                const throttleDelta = deltaY / range;

                const virtualTarget = this.touchStartVirtualThrottle + throttleDelta;
                const clampedVirtual = Math.max(-1.0, Math.min(1.0, virtualTarget));

                const finalThrottle = this.applyDeadzone(clampedVirtual);
                this.setThrottleCallback(finalThrottle);

                if (e.cancelable) e.preventDefault();
            }
        };

        const endGlobalTouch = () => {
            this.isTouchingGlobal = false;
            this.touchStartY = null;
        };

        // Attach global listeners
        window.addEventListener('touchstart', startGlobalTouch, { passive: false });
        window.addEventListener('touchmove', moveGlobalTouch, { passive: false });
        window.addEventListener('touchend', endGlobalTouch);
    }

    private updateThrottleFromSlider(e: MouseEvent | TouchEvent) {
        let clientY;
        // Check for TouchEvent support and instance
        if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent) {
            clientY = e.touches[0].clientY;
        } else if (e instanceof MouseEvent) {
            clientY = e.clientY;
        } else {
            return;
        }

        const rect = this.container.getBoundingClientRect();
        // Calculate relative Y within the container
        // Top of container is 0, bottom is rect.height
        const relativeY = clientY - rect.top;

        // Apply Padding logic (20px)
        const PADDING = 20;
        const availableHeight = rect.height - (PADDING * 2);
        const adjustedY = relativeY - PADDING;
        const ratio = Math.max(0, Math.min(1, adjustedY / availableHeight));

        // Map ratio (0 to 1) to Throttle (1 to -1)
        // 0 -> 1.0
        // 1 -> -1.0
        const rawThrottle = 1.0 - (ratio * 2.0);

        const finalThrottle = this.applyDeadzone(rawThrottle);

        this.setThrottleCallback(finalThrottle);
    }

    private applyDeadzone(value: number): number {
        if (Math.abs(value) < this.DEADZONE_THRESHOLD) {
            return 0;
        }

        // Remap remaining range to 0..1 to allow smooth transition
        const sign = Math.sign(value);
        const abs = Math.abs(value);
        const remapped = (abs - this.DEADZONE_THRESHOLD) / (1.0 - this.DEADZONE_THRESHOLD);

        return sign * remapped;
    }

    private inverseDeadzone(value: number): number {
        // Convert output throttle back to virtual input throttle (linear space)
        if (value === 0) return 0; // Default to center of deadzone

        const sign = Math.sign(value);
        const abs = Math.abs(value);

        const originalAbs = abs * (1.0 - this.DEADZONE_THRESHOLD) + this.DEADZONE_THRESHOLD;
        return sign * originalAbs;
    }
}
