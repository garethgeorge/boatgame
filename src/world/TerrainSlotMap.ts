export interface TerrainSlot {
    type: string;
    x: number;
    y: number;
    z: number;
    isOccupied: boolean;
}

/**
 * Manages attachment slots within a terrain chunk.
 */
export class TerrainSlotMap {
    private slots: TerrainSlot[] = [];

    public registerSlot(type: string, x: number, y: number, z: number) {
        this.slots.push({ type, x, y, z, isOccupied: false });
    }

    public findNearbySlot(type: string, x: number, z: number, maxDistance: number, includeOccupied: boolean = false): TerrainSlot | null {
        return this.findNearbySlots([type], x, z, maxDistance, includeOccupied);
    }

    public findNearbySlots(types: string[], x: number, z: number, maxDistance: number, includeOccupied: boolean = false, predicate?: (slot: TerrainSlot) => boolean): TerrainSlot | null {
        let bestSlot: TerrainSlot | null = null;
        let bestDist = maxDistance;

        for (const slot of this.slots) {
            if (!types.includes(slot.type)) continue;
            if (!includeOccupied && slot.isOccupied) continue;
            if (predicate && !predicate(slot)) continue;

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

    public removeSlotsInRange(zMin: number, zMax: number) {
        this.slots = this.slots.filter(s => s.z < zMin || s.z > zMax);
    }
}
