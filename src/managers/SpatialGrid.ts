import * as THREE from 'three';

// A single placement
export interface PlacementManifest {
    position: THREE.Vector3;

    // The "actual" radii at ground and canopy levels
    groundRadius: number;
    canopyRadius: number;

    // type specific options
    options?: any;
}

export class SpatialGrid {
    private cellSize: number;
    private cellSizeInv: number;
    private maxGroundRadius: number = 0;
    private maxCanopyRadius: number = 0;
    private grid: Map<string, PlacementManifest[]> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.cellSizeInv = 1.0 / cellSize;
    }

    public getCellSize(): number {
        return this.cellSize;
    }

    private getKey(x: number, y: number): string {
        const cx = Math.floor(x * this.cellSizeInv);
        const cy = Math.floor(y * this.cellSizeInv);
        return cx + "," + cy;
    }

    insert(item: PlacementManifest) {
        this.maxGroundRadius = Math.max(this.maxGroundRadius, item.groundRadius);
        this.maxCanopyRadius = Math.max(this.maxCanopyRadius, item.canopyRadius);

        const key = this.getKey(item.position.x, item.position.z);
        let cellItems = this.grid.get(key);
        if (!cellItems) {
            cellItems = [];
            this.grid.set(key, cellItems);
        }
        cellItems.push(item);
    }

    /**
     * Check collision for an object with given clearance radii at ground and
     * canopy levels.
     */
    checkCollision(x: number, y: number, groundRadius: number, canopyRadius: number): boolean {
        const searchRange = Math.max(
            groundRadius + this.maxGroundRadius,
            canopyRadius > 0 ? canopyRadius + this.maxCanopyRadius : 0
        );

        const cx = Math.floor(x * this.cellSizeInv);
        const cy = Math.floor(y * this.cellSizeInv);
        const cellRange = Math.ceil(searchRange * this.cellSizeInv);

        for (let i = -cellRange; i <= cellRange; i++) {
            const icx = cx + i;
            for (let j = -cellRange; j <= cellRange; j++) {
                const icy = cy + j;
                const key = icx + "," + icy;
                const cellItems = this.grid.get(key);
                if (cellItems) {
                    for (let k = 0; k < cellItems.length; k++) {
                        const item = cellItems[k];
                        const dx = x - item.position.x;
                        const dy = y - item.position.z;
                        const distSq = dx * dx + dy * dy;

                        // Check ground collision
                        const groundDist = groundRadius + item.groundRadius;
                        if (distSq < groundDist * groundDist) return true;

                        // Check canopy collision
                        if (canopyRadius > 0.0 && item.canopyRadius > 0) {
                            const canopyDist = canopyRadius + item.canopyRadius;
                            if (distSq < canopyDist * canopyDist) return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Check whether there is a placement whose ground radius intersects the
     * circle.
     */
    checkGroundCollision(x: number, y: number, groundRadius: number): boolean {
        const searchRange = groundRadius + this.maxGroundRadius;
        const cx = Math.floor(x * this.cellSizeInv);
        const cy = Math.floor(y * this.cellSizeInv);
        const cellRange = Math.ceil(searchRange * this.cellSizeInv);

        for (let i = -cellRange; i <= cellRange; i++) {
            const icx = cx + i;
            for (let j = -cellRange; j <= cellRange; j++) {
                const icy = cy + j;
                const key = icx + "," + icy;
                const cellItems = this.grid.get(key);
                if (cellItems) {
                    for (let k = 0; k < cellItems.length; k++) {
                        const item = cellItems[k];
                        const dx = x - item.position.x;
                        const dy = y - item.position.z;
                        const distSq = dx * dx + dy * dy;
                        const groundDist = groundRadius + item.groundRadius;
                        if (distSq < groundDist * groundDist) return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Check whether there is a placement whose canopy radius intersects the
     * circle.
     */
    checkCanopyCollision(x: number, y: number, canopyRadius: number): boolean {
        const searchRange = canopyRadius + this.maxCanopyRadius;
        const cx = Math.floor(x * this.cellSizeInv);
        const cy = Math.floor(y * this.cellSizeInv);
        const cellRange = Math.ceil(searchRange * this.cellSizeInv);

        for (let i = -cellRange; i <= cellRange; i++) {
            const icx = cx + i;
            for (let j = -cellRange; j <= cellRange; j++) {
                const icy = cy + j;
                const key = icx + "," + icy;
                const cellItems = this.grid.get(key);
                if (cellItems) {
                    for (let k = 0; k < cellItems.length; k++) {
                        const item = cellItems[k];
                        if (item.canopyRadius <= 0) continue;
                        const dx = x - item.position.x;
                        const dy = y - item.position.z;
                        const distSq = dx * dx + dy * dy;
                        const canopyDist = canopyRadius + item.canopyRadius;
                        if (distSq < canopyDist * canopyDist) return true;
                    }
                }
            }
        }
        return false;
    }
}
