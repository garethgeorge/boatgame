import * as THREE from 'three';
import { Decorations } from '../world/Decorations';
import { GraphicsUtils } from '../core/GraphicsUtils';

export class CollectedBottles {
    public mesh: THREE.Group;
    private gridConfig = {
        rows: 3,
        cols: 7,
        spacingX: 0.6,
        spacingZ: 0.6
    };
    private grid: (THREE.Group | null)[][];
    private activeBottles: THREE.Group[] = [];
    private cleanupQueue: THREE.Object3D[] = [];

    private mixer: THREE.AnimationMixer;

    // Cached animations (position-independent)
    private dropClip: THREE.AnimationClip;
    private fadeClip: THREE.AnimationClip;
    private leftArcClip: THREE.AnimationClip;
    private rightArcClip: THREE.AnimationClip;

    constructor() {
        this.mesh = new THREE.Group();
        this.mixer = new THREE.AnimationMixer(this.mesh);

        // Get cached animation clips from Decorations
        this.dropClip = Decorations.getBottleDropAnimation();
        this.fadeClip = Decorations.getBottleFadeAnimation();
        this.leftArcClip = Decorations.getBottleLeftArcAnimation();
        this.rightArcClip = Decorations.getBottleRightArcAnimation();

        this.mixer.addEventListener('finished', (e: any) => {
            const action = e.action as THREE.AnimationAction;
            const bottle = action.getRoot() as THREE.Group;
            // The bottle is inside a container. Check if container is marked for removal.
            // Since we play multiple simultaneous actions (Arc, Fade), any of them finishing
            // signals the end of the sequence.
            const container = bottle.parent;
            if (container && container.userData.removing) {
                // Defer cleanup to avoid modifying the mixer while it's updating
                this.cleanupQueue.push(bottle);
            }
        });

        // Initialize grid
        this.grid = Array(this.gridConfig.rows).fill(null).map(() => Array(this.gridConfig.cols).fill(null));

        // Center the grid relative to parent attachment point
        // Total width = (cols-1) * spacingX
        // Total depth = (rows-1) * spacingZ
        const totalWidth = (this.gridConfig.cols - 1) * this.gridConfig.spacingX;
        const totalDepth = (this.gridConfig.rows - 1) * this.gridConfig.spacingZ;

        // Offset to center
        this.mesh.position.set(-totalWidth / 2, 0, -totalDepth / 2);
    }

    update(dt: number) {
        this.processCleanup();
        this.mixer.update(dt);
    }

    private processCleanup() {
        while (this.cleanupQueue.length > 0) {
            const bottle = this.cleanupQueue.pop();
            if (bottle) {
                // Remove visual representation
                const container = bottle.parent;
                if (container) {
                    this.mesh.remove(container);
                }
                GraphicsUtils.disposeObject(bottle);
                // Uncache animation
                this.mixer.uncacheRoot(bottle);
            }
        }
    }

    get count(): number {
        return this.activeBottles.length;
    }

    addBottle(color: number, animated: boolean, delay: number = 0.0) {
        // Find empty slots
        const emptySlots: { r: number, c: number }[] = [];
        for (let r = 0; r < this.gridConfig.rows; r++) {
            for (let c = 0; c < this.gridConfig.cols; c++) {
                if (this.grid[r][c] === null) {
                    emptySlots.push({ r, c });
                }
            }
        }

        if (emptySlots.length === 0) return; // Full

        // Pick random slot
        const slot = emptySlots[Math.floor(Math.random() * emptySlots.length)];

        // Create bottle with specified color, clone so it can be animated
        const bottle = Decorations.getBottle(color);
        GraphicsUtils.cloneMaterials(bottle);

        // Scale down slightly to fit on deck nicely
        bottle.scale.set(0.6, 0.6, 0.6);

        // IMPORTANT: Wrap bottle in a container group
        // Container is positioned at grid location
        // Bottle animates in local space within the container
        const container = new THREE.Group();

        // Grid Position
        const targetX = slot.c * this.gridConfig.spacingX;
        const targetZ = slot.r * this.gridConfig.spacingZ;
        container.position.set(targetX, 0, targetZ);

        container.add(bottle);
        this.mesh.add(container);
        container.userData.color = color;
        this.grid[slot.r][slot.c] = container;
        this.activeBottles.push(container);

        if (animated) {
            this.playFadeAndDropAnimation(bottle, delay);
        }
    }

    removeBottle(animated: boolean): number | null {

        if (this.activeBottles.length === 0) return null;

        // Pick random bottle to remove
        const index = Math.floor(Math.random() * this.activeBottles.length);
        const container = this.activeBottles[index];
        const color = container.userData.color;

        // Get the actual bottle from the container
        const bottle = container.children[0] as THREE.Group;

        // Ensure we stop and uncache any actions for this bottle
        this.mixer.uncacheRoot(bottle);

        // Mark container for removal
        container.userData.removing = true;

        // Find in grid to determine side and clear slot
        let bottleCol = 0;
        let found = false;
        for (let r = 0; r < this.gridConfig.rows; r++) {
            for (let c = 0; c < this.gridConfig.cols; c++) {
                if (this.grid[r][c] === container) {
                    this.grid[r][c] = null;
                    bottleCol = c;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        this.activeBottles.splice(index, 1);

        if (animated) {
            this.playFadeAndArcOut(bottle, bottleCol);
        } else {
            this.cleanupQueue.push(bottle);
        }

        return color;
    }

    transfer(target: CollectedBottles, animated: boolean = true) {
        if (this.activeBottles.length === 0) return;

        // Pick random bottle to remove
        const index = Math.floor(Math.random() * this.activeBottles.length);
        const container = this.activeBottles[index];
        const color = container.userData.color;

        // Get the actual bottle from the container
        const bottle = container.children[0] as THREE.Group;

        // Ensure we stop and uncache any actions for this bottle
        this.mixer.uncacheRoot(bottle);
        container.userData.removing = true;

        // Find in grid to determine side and clear slot
        let found = false;
        for (let r = 0; r < this.gridConfig.rows; r++) {
            for (let c = 0; c < this.gridConfig.cols; c++) {
                if (this.grid[r][c] === container) {
                    this.grid[r][c] = null;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        this.activeBottles.splice(index, 1);

        if (animated) {
            this.playRiseAndFadeOut(bottle);
            // Give it a head start so it looks like it travels
            target.addBottle(color, true, 0.1);
        } else {
            this.cleanupQueue.push(bottle);
            target.addBottle(color, false);
        }
    }

    private playFadeAndArcOut(bottle: THREE.Group, fromColumn: number) {
        // Determine Direction (-1 Left, 1 Right)
        const midPoint = (this.gridConfig.cols - 1) / 2;
        const direction = fromColumn < midPoint ? -1 : 1;

        // Select the appropriate cached arc clip
        const arcClip = direction < 0 ? this.leftArcClip : this.rightArcClip;
        const arcAction = this.mixer.clipAction(arcClip, bottle);

        arcAction.loop = THREE.LoopOnce;
        arcAction.clampWhenFinished = true;
        arcAction.play();

        // Simultaneous Fade Out
        const fadeAction = this.mixer.clipAction(this.fadeClip, bottle);
        const duration = 0.8; // Match arc duration
        // Standard fade 1.0 -> 0 opacity. Clip duration is 1.0.
        fadeAction.timeScale = 1.0 / duration;
        fadeAction.play();
    }

    private playFadeAndDropAnimation(bottle: THREE.Group, delay: number = 0.0) {
        // Bottle starts at drop height in local space
        bottle.position.set(0, 5, 0); // Drop animation will bring it to (0, 0, 0)

        // Hide initially (Set opacity to 0) so it doesn't show up before the delayed fade-in starts
        GraphicsUtils.setMaterialOpacity(bottle, 0);

        // --- Animations (using cached clips) ---
        const startDelay = delay;
        const startTime = this.mixer.time + startDelay;

        // 1. Fade In (Use cached fade animation in reverse)
        // Apply to the actual bottle mesh, not the container
        const fadeAction = this.mixer.clipAction(this.fadeClip, bottle);
        const duration = 0.25;

        // Play backwards to fade IN (0 to Opacity)
        fadeAction.loop = THREE.LoopOnce;
        fadeAction.clampWhenFinished = true;
        fadeAction.timeScale = -1.0 / duration;
        fadeAction.time = fadeAction.getClip().duration; // Start at end
        fadeAction.startAt(startTime);
        fadeAction.play();

        // 2. Drop Down (using cached drop clip)
        // Apply to the bottle, which will animate from (0, 5, 0) to (0, 0, 0) in local space
        const dropAction = this.mixer.clipAction(this.dropClip, bottle);
        dropAction.loop = THREE.LoopOnce;
        dropAction.clampWhenFinished = true;
        dropAction.startAt(startTime);
        dropAction.play();
    }

    private playRiseAndFadeOut(bottle: THREE.Group) {
        const clipDuration = this.dropClip.duration;

        // Rise (Drop Reversed)
        const riseAction = this.mixer.clipAction(this.dropClip, bottle);
        riseAction.loop = THREE.LoopOnce;
        riseAction.clampWhenFinished = true;
        riseAction.timeScale = -1.0;
        riseAction.time = clipDuration;
        riseAction.play();

        // Fade Out
        const fadeAction = this.mixer.clipAction(this.fadeClip, bottle);
        fadeAction.loop = THREE.LoopOnce;
        fadeAction.clampWhenFinished = true;
        fadeAction.timeScale = 1.0 / 0.5; // Fast fade out 
        fadeAction.play();
    }
}
