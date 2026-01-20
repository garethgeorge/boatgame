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
    private maxSearchRadius: number = 0;
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
        const radius = Math.max(item.groundRadius, item.canopyRadius, item.speciesRadius);
        this.maxSearchRadius = Math.max(this.maxSearchRadius, radius);
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
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        // Calculate search range based on largest radius involved
        const radius = Math.max(groundRadius, canopyRadius, speciesRadius);
        const searchRange = radius + this.maxSearchRadius;
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

                        // Rule 1: Ground Overlap
                        const groundDist = groundRadius + item.groundRadius;
                        if (distSq < groundDist * groundDist) {
                            return true;
                        }

                        // Rule 2: Canopy Overlap
                        if (canopyRadius > 0 && item.canopyRadius > 0) {
                            const canopyDist = canopyRadius + item.canopyRadius;
                            if (distSq < canopyDist * canopyDist) {
                                return true;
                            }
                        }

                        // Rule 3: Species Spacing
                        if (speciesId === item.speciesId && speciesRadius > 0 && item.speciesRadius > 0) {
                            const specDist = speciesRadius + item.speciesRadius;
                            if (distSq < specDist * specDist) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }
}
