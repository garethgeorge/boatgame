import { SpawnContext } from '../Spawnable';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverGeometry, RiverGeometrySample } from '../../world/RiverGeometry';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions, ShorePlacementOptions } from '../../managers/PlacementHelper';
import { AnimalSpawner, AnimalSpawnOptions } from './AnimalSpawner';
import { FlyingAnimalOptions } from '../obstacles/FlyingAnimal';
import * as THREE from 'three';

export interface FlyingAnimalSpawnConfig {
    id: string;
    getDensity: (difficulty: number, zStart: number) => number;
    factory: (physicsEngine: PhysicsEngine, options: FlyingAnimalOptions) => Entity;
    entityRadius?: number;
    shoreProbability?: number;
    shorePlacement?: ShorePlacementOptions;
    heightInWater?: number;
    waterPlacement?: RiverPlacementOptions;
}

export class FlyingAnimalSpawner extends AnimalSpawner {
    private config: FlyingAnimalSpawnConfig;

    constructor(config: FlyingAnimalSpawnConfig) {
        super();
        this.config = config;
    }

    get id(): string {
        return this.config.id;
    }

    protected get entityRadius(): number {
        return this.config.entityRadius ?? 3.0;
    }

    protected get shoreProbability(): number {
        return this.config.shoreProbability ?? 1.0;
    }

    protected get shorePlacement(): ShorePlacementOptions {
        return this.config.shorePlacement ?? { minDistFromBank: 2.0, maxDistFromBank: 8.0 };
    }

    protected get heightInWater(): number {
        return this.config.heightInWater ?? 0.0;
    }

    protected get waterPlacement(): RiverPlacementOptions {
        return this.config.waterPlacement ?? {};
    }

    protected getDensity(difficulty: number, zStart: number): number {
        return this.config.getDensity(difficulty, zStart);
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: FlyingAnimalOptions): Entity {
        return this.config.factory(physicsEngine, options);
    }

    spawnAt(context: SpawnContext, z: number): boolean {
        const riverSystem = RiverSystem.getInstance();
        const sample = RiverGeometry.getRiverGeometrySample(riverSystem, z);

        const isShore = Math.random() < this.shoreProbability;
        const aggro = Math.random();

        if (isShore) {
            const shorePlace = this.shorePlacement;
            const left = Math.random() < 0.5;
            const range: [number, number] = left ?
                [-sample.bankDist - (shorePlace.maxDistFromBank || 8.0), -sample.bankDist] :
                [sample.bankDist, sample.bankDist + (shorePlace.maxDistFromBank || 8.0)];
            return this.spawnAnimalAbsolute({ context, sample, distanceRange: range, aggressiveness: aggro });

        } else {
            const range: [number, number] = [-sample.bankDist, sample.bankDist];
            return this.spawnAnimalAbsolute({ context, sample, distanceRange: range, aggressiveness: aggro });
        }
    }

    /**
     * Spawns a flying animal within a distance range from a river position.
     * Supports both shore and water placement.
     */
    spawnAnimalAbsolute(options: AnimalSpawnOptions): boolean {
        const {
            context,
            sample,
            distanceRange,
            aggressiveness,
            disableLogic,
            fixedAngle,
            fixedHeight,
        } = options;

        let placement: any = null;

        const radius = this.entityRadius;
        const minSpacing = this.waterPlacement.minDistFromOthers || 2.0;
        const minWaterDist = this.waterPlacement.minDistFromBank || 2.0;
        const minShoreDist = this.shorePlacement.minDistFromBank || 2.0;
        const maxSlopeDegrees = this.shorePlacement.maxSlopeDegrees || 20.0;

        // Check if range overlaps shore
        const overlapsShore = distanceRange[0] < -sample.bankDist - minShoreDist || distanceRange[1] > sample.bankDist + minShoreDist;

        if (overlapsShore) {
            placement = context.placementHelper.tryShorePlaceAbsolute(
                sample,
                radius,
                minSpacing,
                minShoreDist,
                distanceRange,
                maxSlopeDegrees
            );
        }

        if (!placement) {
            const riverPos = context.placementHelper.tryRiverPlaceAbsolute(
                sample,
                radius,
                minSpacing,
                minWaterDist,
                distanceRange
            );
            if (riverPos) {
                placement = {
                    worldX: riverPos.worldX,
                    worldZ: riverPos.worldZ,
                    height: this.heightInWater,
                    rotation: Math.random() * Math.PI * 2,
                    normal: new THREE.Vector3(0, 1, 0)
                };
            }
        }

        if (placement) {
            const entity = this.spawnEntity(context.physicsEngine, {
                x: placement.worldX,
                y: placement.worldZ,
                angle: fixedAngle !== undefined ? fixedAngle : placement.rotation,
                height: fixedHeight !== undefined ? fixedHeight : placement.height,
                terrainNormal: placement.normal,
                aggressiveness,
                disableLogic,
                zRange: [context.biomeZMin, context.biomeZMax]
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }
}

