import * as THREE from 'three';
import { SpawnContext } from '../Spawnable';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions, ShorePlacementOptions } from '../../managers/PlacementHelper';
import { RiverGeometry, RiverGeometrySample } from '../../world/RiverGeometry';
import { AnimalSpawner, AnimalSpawnOptions } from './AnimalSpawner';
import { SwimAwayAnimalBehavior, SwimAwayAnimalOptions } from '../obstacles/SwimAwayAnimal';
import { RiverSystem } from '../../world/RiverSystem';

export interface SwimAwayAnimalSpawnConfig {
    id: string;
    getDensity: (difficulty: number, zStart: number) => number;
    factory: (physicsEngine: PhysicsEngine, options: SwimAwayAnimalOptions) => Entity;
    heightInWater: number;
    shoreProbability?: number;
    entityRadius?: number;
    waterPlacement?: RiverPlacementOptions;
    shorePlacement?: ShorePlacementOptions;
}

export class SwimAwayAnimalSpawner extends AnimalSpawner {
    private config: SwimAwayAnimalSpawnConfig;

    constructor(config: SwimAwayAnimalSpawnConfig) {
        super();
        this.config = config;
    }

    get id(): string {
        return this.config.id;
    }

    protected get entityRadius(): number {
        return this.config.entityRadius ?? 2.0;
    }
    protected get shoreProbability(): number {
        return this.config.shoreProbability ?? 0.0;
    }
    protected get shorePlacement(): ShorePlacementOptions {
        return this.config.shorePlacement ?? { minDistFromBank: 3.0, maxDistFromBank: 6.0 };
    }
    protected get waterPlacement(): RiverPlacementOptions {
        return this.config.waterPlacement ?? { minDistFromBank: 1.0 };
    }
    protected get heightInWater(): number {
        return this.config.heightInWater;
    }
    protected getDensity(difficulty: number, zStart: number): number {
        return this.config.getDensity(difficulty, zStart);
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
                [-sample.bankDist - (shorePlace.maxDistFromBank || 6.0), -sample.bankDist] :
                [sample.bankDist, sample.bankDist + (shorePlace.maxDistFromBank || 6.0)];
            return this.spawnAnimalAbsolute({ context, sample, distanceRange: range, aggressiveness: aggro });

        } else {
            const range: [number, number] = [-sample.bankDist, sample.bankDist];
            return this.spawnAnimalAbsolute({ context, sample, distanceRange: range, aggressiveness: aggro });
        }
    }

    /**
     * Spawns an animal at an absolute river position.
     */
    spawnAnimalAbsolute(options: AnimalSpawnOptions): boolean {
        const {
            context,
            sample,
            distanceRange,
            aggressiveness,
            disableLogic,
            fixedAngle,
            fixedHeight
        } = options;

        let placement: any = null;

        const radius = this.entityRadius;
        const minSpacing = this.waterPlacement.minDistFromOthers || 2.0;
        const minWaterDist = this.waterPlacement.minDistFromBank || 1.0;
        const minShoreDist = this.shorePlacement.minDistFromBank || 2.0;
        const maxSlopeDegrees = this.shorePlacement.maxSlopeDegrees || 20.0;

        // Check if range overlaps shore
        const overlapsShore = distanceRange[0] < -sample.bankDist - minShoreDist || distanceRange[1] > sample.bankDist + minShoreDist;

        let behavior: SwimAwayAnimalBehavior = 'wait';
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
            behavior = 'swim';
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
                    height: fixedHeight !== undefined ? fixedHeight : this.heightInWater,
                    rotation: fixedAngle !== undefined ? fixedAngle : Math.random() * Math.PI * 2,
                    normal: new THREE.Vector3(0, 1, 0)
                };
            }
        }

        if (placement) {
            const entity = this.config.factory(context.physicsEngine, {
                x: placement.worldX,
                y: placement.worldZ,
                height: fixedHeight !== undefined ? fixedHeight : placement.height,
                angle: fixedAngle !== undefined ? fixedAngle : placement.rotation,
                terrainNormal: placement.normal,
                aggressiveness,
                swimBehavior: behavior,
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
