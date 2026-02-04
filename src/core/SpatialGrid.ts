import * as THREE from 'three';

// A single placement
export interface PlacementManifest {
    position: THREE.Vector3;

    // The "actual" radii at ground and canopy levels
    groundRadius: number;
    canopyRadius: number;

    // type specific options
    options?: any;
};

export interface AnySpatialGrid {
    getCellSize(): number;

    insert(item: PlacementManifest);

    /**
     * Check collision for an object with given clearance radii at ground and
     * canopy levels. True => there is a collision.
     */
    checkCollision(x: number, y: number, groundRadius: number, canopyRadius: number): boolean;

    /**
     * Check whether there is a placement whose ground radius intersects the
     * circle.
     */
    checkGroundCollision(x: number, y: number, groundRadius: number): boolean;
};

export class SpatialGridPair implements AnySpatialGrid {
    private grid1: AnySpatialGrid;
    private grid2: AnySpatialGrid;

    constructor(grid1: AnySpatialGrid, grid2: AnySpatialGrid) {
        this.grid1 = grid1;
        this.grid2 = grid2;
    }

    public getCellSize(): number {
        return this.grid1.getCellSize();
    }

    public insert(item: PlacementManifest) {
        this.grid1.insert(item);
    }

    public checkCollision(x: number, y: number, groundRadius: number, canopyRadius: number): boolean {
        return this.grid1.checkCollision(x, y, groundRadius, canopyRadius) ||
            this.grid2.checkCollision(x, y, groundRadius, canopyRadius);
    }

    public checkGroundCollision(x: number, y: number, groundRadius: number): boolean {
        return this.grid1.checkGroundCollision(x, y, groundRadius) ||
            this.grid2.checkGroundCollision(x, y, groundRadius);
    }
};

export class SpatialGrid implements AnySpatialGrid {
    private cellSize: number;
    private cellSizeInv: number;
    private grid: Map<string, PlacementManifest[]> = new Map();
    // No more maxGroundRadius or maxCanopyRadius

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.cellSizeInv = 1.0 / cellSize;
    }

    public getCellSize(): number {
        return this.cellSize;
    }

    private getKey(icx: number, icy: number): string {
        return icx + "," + icy;
    }

    insert(item: PlacementManifest) {
        const radius = Math.max(item.groundRadius, item.canopyRadius);

        const cxStart = Math.floor((item.position.x - radius) * this.cellSizeInv);
        const cyStart = Math.floor((item.position.z - radius) * this.cellSizeInv);
        const cxEnd = Math.floor((item.position.x + radius) * this.cellSizeInv);
        const cyEnd = Math.floor((item.position.z + radius) * this.cellSizeInv);

        for (let icx = cxStart; icx <= cxEnd; icx++) {
            for (let icy = cyStart; icy <= cyEnd; icy++) {
                const key = this.getKey(icx, icy);
                let cellItems = this.grid.get(key);
                if (!cellItems) {
                    cellItems = [];
                    this.grid.set(key, cellItems);
                }
                cellItems.push(item);
            }
        }
    }

    /**
     * Check collision for an object with given clearance radii at ground and
     * canopy levels.
     */
    checkCollision(x: number, y: number, groundRadius: number, canopyRadius: number): boolean {
        const radius = Math.max(groundRadius, canopyRadius);

        const cxStart = Math.floor((x - radius) * this.cellSizeInv);
        const cyStart = Math.floor((y - radius) * this.cellSizeInv);
        const cxEnd = Math.floor((x + radius) * this.cellSizeInv);
        const cyEnd = Math.floor((y + radius) * this.cellSizeInv);

        for (let icx = cxStart; icx <= cxEnd; icx++) {
            for (let icy = cyStart; icy <= cyEnd; icy++) {
                const key = this.getKey(icx, icy);
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
        const cxStart = Math.floor((x - groundRadius) * this.cellSizeInv);
        const cyStart = Math.floor((y - groundRadius) * this.cellSizeInv);
        const cxEnd = Math.floor((x + groundRadius) * this.cellSizeInv);
        const cyEnd = Math.floor((y + groundRadius) * this.cellSizeInv);

        for (let icx = cxStart; icx <= cxEnd; icx++) {
            for (let icy = cyStart; icy <= cyEnd; icy++) {
                const key = this.getKey(icx, icy);
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
        const cxStart = Math.floor((x - canopyRadius) * this.cellSizeInv);
        const cyStart = Math.floor((y - canopyRadius) * this.cellSizeInv);
        const cxEnd = Math.floor((x + canopyRadius) * this.cellSizeInv);
        const cyEnd = Math.floor((y + canopyRadius) * this.cellSizeInv);

        for (let icx = cxStart; icx <= cxEnd; icx++) {
            for (let icy = cyStart; icy <= cyEnd; icy++) {
                const key = this.getKey(icx, icy);
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
