import {
    TransformNode,
    AnimationGroup,
    Vector3,
    Mesh
} from '@babylonjs/core';
import { Decorations } from '../world/Decorations';
import { GraphicsUtils } from '../core/GraphicsUtils';

export class CollectedBottles {
    public mesh: TransformNode;
    private gridConfig = {
        rows: 3,
        cols: 7,
        spacingX: 0.6,
        spacingZ: 0.6
    };
    private grid: (TransformNode | null)[][];
    private activeBottles: TransformNode[] = [];
    // Cleanup in Babylon is usually handled by disposal or auto-GC if references drop, 
    // but explicit disposal is better for meshes.

    // We don't need a mixer. AnimationGroups are independent.

    constructor() {
        this.mesh = new TransformNode("collectedBottlesRoot");

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
        // Babylon animations update automatically.
        // Unless we need custom logic per frame.
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

        // Create bottle with specified color
        const bottle = Decorations.getBottle(color) as TransformNode;

        // Scale down slightly to fit on deck nicely
        bottle.scaling.set(0.6, 0.6, 0.6);

        // IMPORTANT: Wrap bottle in a container group (TransformNode)
        // Container is positioned at grid location
        // Bottle animates in local space within the container
        const container = new TransformNode("bottleContainer");
        // Using metadata instead of userData
        container.metadata = { color: color };

        // Grid Position
        const targetX = slot.c * this.gridConfig.spacingX;
        const targetZ = slot.r * this.gridConfig.spacingZ;
        container.position.set(targetX, 0, targetZ);

        bottle.parent = container;
        container.parent = this.mesh;

        this.grid[slot.r][slot.c] = container;
        this.activeBottles.push(container);

        if (animated) {
            // We need to create animations targeting *this specific bottle*
            // Decorations.getBottle*Animation() methods need to be updated to take target.
            // Or we call factory directly if Decorations exposes it?
            // "Decorations.getBottleFadeAnimation" isn't migrated yet in Decorations.ts.
            // We need to access BottleFactory via Decorations.
            // But checking Decorations.ts, I commented out getBottleFadeAnimation etc?
            // Ah, I commented them out because they returned THREE.AnimationClip.
            // I need to use the factories or re-implement helpers in Decorations.

            // Assuming Decorations.getFactory('bottle') is available.
            // Or add static helpers back to Decorations.ts.
            // For now, let's assume we can access factory logic or Decorations has helpers.
            // I'll assume we update Decorations.ts to expose these helpers again.

            // Quick fix: access factory via registry if public, or add methods to Decorations.
            // To be clean, I should add the methods to Decorations.ts.
            // But for now, let's assume methods exist:
            // Decorations.playBottleDrop(bottle, delay) -> handles creation and playing?

            // Let's implement logic here using factory.
            // We can't easily access factory instance from here without import.
            // Let's assume Decorations exposes `getBottleFactory()` or `createBottleAnimation(name, target)`.
            // Actually, `Decorations.getFactory('bottle')` (if I expose Registry or make public).
            // `Decorations.ts` has `getBottle`. 

            // Let's update Decorations.ts to expose animation creation first?
            // Or better: `Decorations.createBottleAnimation(name, target)`.

            // I'll assume `Decorations.createBottleAnimation(name, target)` exists.
            // I'll update Decorations.ts next.

            this.playFadeAndDropAnimation(bottle, delay);
        }
    }

    removeBottle(animated: boolean): number | null {

        if (this.activeBottles.length === 0) return null;

        // Pick random bottle to remove
        const index = Math.floor(Math.random() * this.activeBottles.length);
        const container = this.activeBottles[index];
        const color = container.metadata.color;

        // Get the actual bottle from the container
        const bottle = container.getChildren()[0] as TransformNode;

        // Mark container for removal
        container.metadata.removing = true;

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
            this.playFadeAndArcOut(bottle, bottleCol, container);
        } else {
            container.dispose();
        }

        return color;
    }

    transfer(target: CollectedBottles, animated: boolean = true) {
        if (this.activeBottles.length === 0) return;

        // Pick random bottle to remove
        const index = Math.floor(Math.random() * this.activeBottles.length);
        const container = this.activeBottles[index];
        const color = container.metadata.color;

        // Get the actual bottle from the container
        const bottle = container.getChildren()[0] as TransformNode;

        container.metadata.removing = true;

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
            this.playRiseAndFadeOut(bottle, container);
            // Give it a head start so it looks like it travels
            target.addBottle(color, true, 0.1);
        } else {
            container.dispose();
            target.addBottle(color, false);
        }
    }

    private playFadeAndArcOut(bottle: TransformNode, fromColumn: number, container: TransformNode) {
        // Determine Direction (-1 Left, 1 Right)
        const midPoint = (this.gridConfig.cols - 1) / 2;
        const direction = fromColumn < midPoint ? -1 : 1;

        const animName = direction < 0 ? 'arc-left' : 'arc-right';
        const animGroup = Decorations.createBottleAnimation(animName, bottle);
        const fadeGroup = Decorations.createBottleAnimation('fade', bottle);

        // Arc
        animGroup.onAnimationEndObservable.add(() => {
            animGroup.dispose();
            fadeGroup.dispose();
            container.dispose();
        });

        animGroup.play(false);

        // Fade Out (1.0 -> 0)
        // fadeGroup is 0.6->0.
        // We might want to fade from current alpha?
        // Default fade is fine.
        fadeGroup.play(false);
    }

    private playFadeAndDropAnimation(bottle: TransformNode, delay: number = 0.0) {
        // Bottle starts at drop height in local space?
        // Animation sets keys.

        // Hide initially? Babylon AnimationGroup doesn't easily support "hide until delay".
        // Use setTimeout for delay.

        bottle.setEnabled(false);

        setTimeout(() => {
            if (bottle.isDisposed()) return;
            bottle.setEnabled(true);

            const dropGroup = Decorations.createBottleAnimation('drop', bottle);
            const fadeGroup = Decorations.createBottleAnimation('fade', bottle); // 0.6->0

            // We want Fade In (0->0.6).
            // Play in reverse? speedRatio = -1.
            // Start at end.

            fadeGroup.start(false, -1.0, fadeGroup.to, fadeGroup.from);

            dropGroup.play(false);

            dropGroup.onAnimationEndObservable.add(() => {
                dropGroup.dispose();
                fadeGroup.dispose();
            });

        }, delay * 1000);
    }

    private playRiseAndFadeOut(bottle: TransformNode, container: TransformNode) {

        // Rise (Drop Reversed)
        const riseGroup = Decorations.createBottleAnimation('drop', bottle);
        // Play reverse
        riseGroup.start(false, -1.0, riseGroup.to, riseGroup.from);

        // Fade Out
        const fadeGroup = Decorations.createBottleAnimation('fade', bottle);
        fadeGroup.play(false);

        riseGroup.onAnimationEndObservable.add(() => {
            riseGroup.dispose();
            fadeGroup.dispose();
            container.dispose();
        });
    }
}
