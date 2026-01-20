import * as THREE from 'three';

// A single placement
export interface PlacementManifest {
    speciesId: string;
    position: THREE.Vector3;
    groundRadius: number; // Stored for collision checks (includes spacing adjustments)
    canopyRadius: number;
    speciesRadius: number;
    fitness: number; // Stored to optimize local growth
    options?: any; // type specific - should include scale if needed
}

export class SpatialGrid {
    private cellSize: number;
    private maxGroundRadius: number = 0;
    private maxCanopyRadius: number = 0;
    private maxSpeciesRadius: number = 0;
    private grid: Map<string, PlacementManifest[]> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    private getKey(x: number, y: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(item: PlacementManifest) {
        this.maxGroundRadius = Math.max(this.maxGroundRadius, item.groundRadius);
        this.maxCanopyRadius = Math.max(this.maxCanopyRadius, item.canopyRadius);
        this.maxSpeciesRadius = Math.max(this.maxSpeciesRadius, item.speciesRadius);

        const key = this.getKey(item.position.x, item.position.z);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(item);
    }

    checkCollision(
        x: number, y: number,
        groundRadius: number,
        canopyRadius: number,
        speciesRadius: number,
        speciesId: string
    ): boolean {

        // Working from smallest to largest radii
        if (this.checkGroundCollision(x, y, groundRadius))
            return true;

        if (canopyRadius > 0 && this.checkCanopyCollision(x, y, canopyRadius))
            return true;

        if (speciesRadius > 0 && this.checkSpeciesCollision(x, y, speciesRadius, speciesId))
            return true;

        return false;
    }

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

    checkSpeciesCollision(x: number, y: number, speciesRadius: number, speciesId: string): boolean {
        const searchRange = speciesRadius + this.maxSpeciesRadius;
        return this.checkCollisionPredicate(
            x, y, searchRange,
            (item: PlacementManifest, distSq: number) => {
                if (speciesId !== item.speciesId || item.speciesRadius <= 0) return false;
                const specDist = speciesRadius + item.speciesRadius;
                return (distSq < specDist * specDist);
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
