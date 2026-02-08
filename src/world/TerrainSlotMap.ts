export interface TerrainSlot {
    type: string;
    x: number;
    y: number;
    z: number;
}

/**
 * Manages attachment slots within a terrain chunk.
 */
export class TerrainSlotMap {
    private slots: TerrainSlot[] = [];

    public registerSlot(type: string, x: number, y: number, z: number) {
        this.slots.push({ type, x, y, z });
    }

    public findNearbySlot(type: string, x: number, z: number, maxDistance: number): TerrainSlot | null {
        let bestSlot: TerrainSlot | null = null;
        let bestDist = maxDistance;

        for (const slot of this.slots) {
            if (slot.type !== type) continue;
            const dx = slot.x - x;
            const dz = slot.z - z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < bestDist) {
                bestDist = dist;
                bestSlot = slot;
            }
        }

        return bestSlot;
    }
}
