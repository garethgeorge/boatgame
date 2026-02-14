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

    public sample(x: number, z: number, waterHeight: number, margin: number): { y: number, normal: THREE.Vector3, zone: Zone } {
        const riverSystem = RiverSystem.getInstance();
        const terrainHeight = riverSystem.terrainGeometry.calculateHeight(x, z);
        const terrainNormal = riverSystem.terrainGeometry.calculateNormal(x, z);

        const banks = riverSystem.getBankPositions(z);
        const distFromLeft = x - banks.left;
        const distFromRight = banks.right - x;
        const distIntoWater = Math.min(distFromLeft, distFromRight);

        let height = terrainHeight;
        let zone: Zone = 'land';

        if (distIntoWater < 0) {
            // Out of water (on land)
            height = terrainHeight;
            zone = 'land';
        } else if (distIntoWater < margin) {
            // Margin area
            const t = distIntoWater / margin;
            height = terrainHeight * (1 - t) + waterHeight * t;
            zone = 'margin';
        } else {
            // Fully in water
            height = waterHeight;
            zone = 'water';
        }

        return { y: height, normal: terrainNormal, zone };
    }
}
