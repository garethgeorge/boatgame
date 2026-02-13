import * as THREE from 'three';
import { TerrainMap } from './TerrainMap';
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

    public sample(x: number, z: number, waterHeight: number): { y: number, normal: THREE.Vector3 } {
        const riverSystem = RiverSystem.getInstance();
        const terrainHeight = riverSystem.terrainGeometry.calculateHeight(x, z);
        const terrainNormal = riverSystem.terrainGeometry.calculateNormal(x, z);

        const banks = riverSystem.getBankPositions(z);
        let normalHeight = terrainHeight;
        if (x > banks.left && x < banks.right) {
            const distFromBank = Math.min(Math.abs(x - banks.left), Math.abs(x - banks.right));
            const t = Math.min(1.0, distFromBank / 2.0);
            normalHeight = terrainHeight * (1 - t) + waterHeight * t;
        }

        return { y: normalHeight, normal: terrainNormal };
    }
}
