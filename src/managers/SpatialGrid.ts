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
    private maxGroundRadius: number = 0;
    private maxCanopyRadius: number = 0;
    private grid: Map<string, PlacementManifest[]> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    public getCellSize(): number {
        return this.cellSize;
    }

    private getKey(x: number, y: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(item: PlacementManifest) {
        this.maxGroundRadius = Math.max(this.maxGroundRadius, item.groundRadius);
        this.maxCanopyRadius = Math.max(this.maxCanopyRadius, item.canopyRadius);

        const key = this.getKey(item.position.x, item.position.z);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(item);
    }

    /**
     * Check collision for an object with given clearance radii at ground and
     * canopy levels.
     */
    checkCollision(x: number, y: number, groundRadius: number, canopyRadius: number): boolean {
        if (this.checkGroundCollision(x, y, groundRadius))
            return true;
        if (canopyRadius > 0.0 && this.checkCanopyCollision(x, y, canopyRadius))
            return true;
        return false;
    }

    /**
     * Check whether there is a placement whose ground radius intersects the
     * circle.
     */
    checkGroundCollision(x: number, y: number, groundRadius: number): boolean {
        const searchRange = groundRadius + this.maxGroundRadius;
        return this.checkCollisionPredicate(
            x, y, searchRange,
            (item: PlacementManifest, distSq: number) => {
                const groundDist = groundRadius + item.groundRadius;
                return (distSq < groundDist * groundDist);
            }
        );
    }

    /**
     * Check whether there is a placement whose canopy radius intersects the
     * circle.
     */
    checkCanopyCollision(x: number, y: number, canopyRadius: number): boolean {
        const searchRange = canopyRadius + this.maxCanopyRadius;
        return this.checkCollisionPredicate(
            x, y, searchRange,
            (item: PlacementManifest, distSq: number) => {
                if (item.canopyRadius <= 0) return false;
                const canopyDist = canopyRadius + item.canopyRadius;
                return (distSq < canopyDist * canopyDist);
            }
        );
    }

    checkCollisionPredicate(
        x: number, y: number,
        searchRange: number,
        predicate: (item: PlacementManifest, distSq: number) => boolean
    ): boolean {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        // Calculate search range based on largest radius involved
        const cellRange = Math.ceil(searchRange / this.cellSize);

        for (let i = -cellRange; i <= cellRange; i++) {
            for (let j = -cellRange; j <= cellRange; j++) {
                const key = `${cx + i},${cy + j}`;
                const cellItems = this.grid.get(key);
                if (cellItems) {
                    for (const item of cellItems) {
                        const dx = x - item.position.x;
                        const dy = y - item.position.z;
                        const distSq = dx * dx + dy * dy;

                        if (predicate(item, distSq))
                            return true;
                    }
                }
            }
        }
        return false;
    }
}
