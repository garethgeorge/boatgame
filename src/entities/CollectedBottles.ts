import * as THREE from 'three';
import { Decorations } from '../world/Decorations';

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

    constructor() {
        this.mesh = new THREE.Group();
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

    addBottle(color: number) {
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
        const bottle = Decorations.getBottleMesh(color);

        // Scale down slightly to fit on deck nicely? 
        // Original bottle is ~2.0 high with cork. 
        // 0.4 radius. Grid spacing 0.6 is tight (0.8 diameter).
        // Let's scale to 0.6 to fit better
        bottle.scale.set(0.6, 0.6, 0.6);

        // Position based on grid
        bottle.position.x = slot.c * this.gridConfig.spacingX;
        bottle.position.z = slot.r * this.gridConfig.spacingZ;

        this.mesh.add(bottle);
        this.grid[slot.r][slot.c] = bottle;
        this.activeBottles.push(bottle);
    }

    removeBottle() {
        if (this.activeBottles.length === 0) return;

        // Pick random bottle to remove
        const index = Math.floor(Math.random() * this.activeBottles.length);
        const bottleToRemove = this.activeBottles[index];

        // Find in grid to clear slot
        let found = false;
        for (let r = 0; r < this.gridConfig.rows; r++) {
            for (let c = 0; c < this.gridConfig.cols; c++) {
                if (this.grid[r][c] === bottleToRemove) {
                    this.grid[r][c] = null;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        this.mesh.remove(bottleToRemove);
        this.activeBottles.splice(index, 1);
    }

    get count(): number {
        return this.activeBottles.length;
    }
}
