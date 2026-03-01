import * as THREE from 'three';
import { TerrainMap, Zone, SurfaceInfo, ShoreInfo } from './TerrainMap';
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

    public getSurfaceInfo(x: number, z: number): SurfaceInfo {
        const riverSystem = RiverSystem.getInstance();
        const banks = riverSystem.getBankPositions(z);

        if (banks.left < x && x < banks.right) {
            return { y: 0, normal: new THREE.Vector3(0, 1, 0), zone: 'water' };
        }

        const terrainHeight = riverSystem.terrainGeometry.calculateHeight(x, z);
        const terrainNormal = riverSystem.terrainGeometry.calculateNormal(x, z);

        return { y: terrainHeight, normal: terrainNormal, zone: 'land' };
    }

    public getZone(
        x: number, z: number, radius: number
    ): { zone: Zone, t: number } {
        const riverSystem = RiverSystem.getInstance();
        const banks = riverSystem.getBankPositions(z);
        const distFromLeft = x - banks.left;
        const distFromRight = banks.right - x;
        const signedWaterDistance = Math.min(distFromLeft, distFromRight);

        let t = 0;
        if (radius > 0) {
            t = Math.max(-1, Math.min(1, signedWaterDistance / radius));
        } else {
            t = signedWaterDistance > 0 ? 1 : signedWaterDistance < 0 ? -1 : 0;
        }

        let zone: Zone = 'margin';
        if (signedWaterDistance >= radius) {
            zone = 'water';
        } else if (signedWaterDistance <= -radius) {
            zone = 'land';
        }

        return { zone, t };
    }

    public getNearestShoreline(x: number, z: number): ShoreInfo {
        const riverSystem = RiverSystem.getInstance();
        const banks = riverSystem.getBankPositions(z);
        const derivation = riverSystem.getRiverDerivative(z);

        let position: THREE.Vector2;
        let normal: THREE.Vector2;
        let distance: number;

        if (Math.abs(x - banks.left) < Math.abs(x - banks.right)) {
            position = new THREE.Vector2(banks.left, z);
            distance = Math.abs(x - banks.left);
            normal = new THREE.Vector2(1, -derivation).normalize();
        } else {
            position = new THREE.Vector2(banks.right, z);
            distance = Math.abs(x - banks.right);
            normal = new THREE.Vector2(-1, derivation).normalize();
        }

        const direction = new THREE.Vector2(normal.y, -normal.x);

        return { position, direction, normal, distance };
    }

    public getDirectionShoreline(startX: number, startZ: number, dirX: number, dirZ: number): ShoreInfo | null {
        const riverSystem = RiverSystem.getInstance();
        const distance = riverSystem.getDistanceToWater(new THREE.Vector2(startX, startZ), { x: dirX, y: dirZ });
        if (distance < 0) return null;

        const intersectX = startX + dirX * distance;
        const intersectZ = startZ + dirZ * distance;

        const shoreInfo = this.getNearestShoreline(intersectX, intersectZ);
        shoreInfo.distance = distance;
        return shoreInfo;
    }

    public getNearestWaterFlow(x: number, z: number): THREE.Vector2 {
        const riverSystem = RiverSystem.getInstance();
        const dx = riverSystem.getRiverDerivative(z);
        // Flow is in -Z direction by default, so derivative dz/dz = -1
        return new THREE.Vector2(dx, -1).normalize();
    }
}
