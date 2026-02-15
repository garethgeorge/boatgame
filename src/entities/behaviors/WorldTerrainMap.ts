import * as THREE from 'three';
import { TerrainMap, Zone } from './TerrainMap';
import { RiverSystem } from '../../world/RiverSystem';

export class WorldTerrainMap implements TerrainMap {
    private static instance: WorldTerrainMap;

    private constructor() { }

    public static getInstance(): WorldTerrainMap {
        if (!WorldTerrainMap.instance) {
            WorldTerrainMap.instance = new WorldTerrainMap();
        }
        return WorldTerrainMap.instance;
    }

    public sample(x: number, z: number): { y: number, normal: THREE.Vector3 } {
        const riverSystem = RiverSystem.getInstance();
        const terrainHeight = riverSystem.terrainGeometry.calculateHeight(x, z);
        const terrainNormal = riverSystem.terrainGeometry.calculateNormal(x, z);

        return { y: terrainHeight, normal: terrainNormal };
    }

    public zone(
        x: number, z: number, margin: number, width: number
    ): { zone: Zone, t: number } {
        const riverSystem = RiverSystem.getInstance();
        const banks = riverSystem.getBankPositions(z);
        const distFromLeft = x - banks.left;
        const distFromRight = banks.right - x;
        const distance = Math.min(distFromLeft, distFromRight);

        if (margin < distance) {
            return { zone: 'water', t: 0 };
        } else if (width <= 0 || distance < margin - width) {
            return { zone: 'land', t: 0 };
        } else {
            return { zone: 'margin', t: (margin - distance) / width };
        }
    }
}
