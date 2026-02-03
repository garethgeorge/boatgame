import * as THREE from 'three';
import { SpawnContext } from '../Spawnable';
import { RiverGeometry, RiverGeometrySample } from '../../world/RiverGeometry';
import { BaseSpawner } from './BaseSpawner';
import { AnimalOptions } from '../obstacles/Animal';
import { AnimalBehaviorConfig } from '../behaviors/AnimalBehaviorConfigs';

import { DecorationId, Decorations } from '../../world/Decorations';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions, ShorePlacementOptions } from '../../managers/PlacementHelper';
import { RiverSystem } from '../../world/RiverSystem';

export interface AnimalSpawnerConfig {
    id: string;
    decorationIds: DecorationId[];
    getDensity: (difficulty: number, zStart: number) => number;
    factory: (physicsEngine: PhysicsEngine, options: AnimalOptions) => Entity;
    entityRadius?: number;
    shoreProbability?: number;
    heightInWater?: number;
    waterPlacement?: RiverPlacementOptions;
    shorePlacement?: ShorePlacementOptions;
    defaultWaterBehavior?: AnimalBehaviorConfig;
    defaultShoreBehavior?: AnimalBehaviorConfig;
}

/**
 * Spawn options. All parameters are optional so that options can be created
 * by combining partial sets.
 */
export interface AnimalSpawnOptions {
    distanceRange?: [number, number];
    aggressiveness?: number;
    biomeZRange?: [number, number];
    behavior?: AnimalBehaviorConfig;

    // These are used for debugging so animals can be placed at an exact
    // location and then inspected visually
    disableLogic?: boolean;
    fixedAngle?: number;
    fixedHeight?: number;
}

/**
 * Concrete implementation for all animal-related spawners (Attack, Swimming, Shore).
 */
export class AnimalSpawner extends BaseSpawner {
    private config: AnimalSpawnerConfig;

    constructor(config: AnimalSpawnerConfig) {
        super();
        this.config = config;
    }

    get id(): string {
        return this.config.id;
    }

    protected getDensity(difficulty: number, zStart: number): number {
        return this.config.getDensity(difficulty, zStart);
    }

    *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* Decorations.ensureAllLoaded(this.config.decorationIds);
    }

    spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
        const riverSystem = RiverSystem.getInstance();
        const sample = RiverGeometry.getRiverGeometrySample(riverSystem, z);

        const isShore = Math.random() < (this.config.shoreProbability ?? 0.0);
        const aggro = Math.random();

        if (isShore) {
            const shorePlace = this.config.shorePlacement ?? { minDistFromBank: 3.0, maxDistFromBank: 8.0 };
            const left = Math.random() < 0.5;
            const range: [number, number] = left ?
                [-sample.bankDist - (shorePlace.maxDistFromBank || 8.0), -sample.bankDist] :
                [sample.bankDist, sample.bankDist + (shorePlace.maxDistFromBank || 8.0)];
            return this.spawnOnLand(context, sample, {
                distanceRange: range,
                aggressiveness: aggro,
                biomeZRange,
                behavior: this.config.defaultShoreBehavior
            });
        } else {
            const range: [number, number] = [-sample.bankDist, sample.bankDist];
            return this.spawnInRiver(context, sample, {
                distanceRange: range,
                aggressiveness: aggro,
                biomeZRange,
                behavior: this.config.defaultWaterBehavior
            });
        }
    }

    /**
     * Spawns an animal on land within a distance range from a river position.
     */
    spawnOnLand(
        context: SpawnContext,
        sample: RiverGeometrySample,
        options: AnimalSpawnOptions
    ): boolean {
        const {
            distanceRange = [-10, 10],
            aggressiveness,
            behavior,
            disableLogic,
            fixedAngle,
            fixedHeight
        } = options;

        const radius = this.config.entityRadius ?? 2.0;
        const minSpacing = this.config.waterPlacement?.minDistFromOthers ?? 2.0;
        const minShoreDist = this.config.shorePlacement?.minDistFromBank ?? 2.0;
        const maxSlopeDegrees = this.config.shorePlacement?.maxSlopeDegrees || 30.0;

        // Check if range overlaps shore (outside the main channel)
        const overlapsShore = distanceRange[0] < -sample.bankDist - minShoreDist || distanceRange[1] > sample.bankDist + minShoreDist;
        if (!overlapsShore) {
            return false;
        }

        const placement = context.placementHelper.tryShorePlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minShoreDist,
            distanceRange,
            maxSlopeDegrees
        );

        if (placement) {
            const finalBehavior = behavior ?? this.config.defaultShoreBehavior;
            return this.createEntity(context, {
                x: placement.worldX,
                y: placement.worldZ,
                angle: fixedAngle !== undefined ? fixedAngle : placement.rotation,
                height: fixedHeight !== undefined ? fixedHeight : placement.height,
                terrainNormal: placement.normal,
                aggressiveness,
                behavior: finalBehavior,
                disableLogic,
                zRange: options.biomeZRange
            });
        }
        return false;
    }

    /**
     * Spawns an animal in the river within a distance range from a river position.
     */
    spawnInRiver(
        context: SpawnContext,
        sample: RiverGeometrySample,
        options: AnimalSpawnOptions
    ): boolean {
        const {
            distanceRange = [-10, 10],
            aggressiveness,
            behavior,
            disableLogic,
            fixedAngle,
            fixedHeight
        } = options;

        const radius = this.config.entityRadius ?? 2.0;
        const minSpacing = this.config.waterPlacement?.minDistFromOthers ?? 2.0;
        const minBankDist = this.config.waterPlacement?.minDistFromBank ?? 1.0;

        // Check if range is outside river
        const riverRange = [-sample.bankDist + minBankDist, sample.bankDist - minBankDist];
        const outsideRiver = distanceRange[1] < riverRange[0] || riverRange[1] < distanceRange[0];
        if (outsideRiver) {
            return false;
        }

        const riverPos = context.placementHelper.tryRiverPlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minBankDist,
            distanceRange
        );

        if (riverPos) {
            const finalBehavior = behavior ?? this.config.defaultWaterBehavior;
            const placement = {
                worldX: riverPos.worldX,
                worldZ: riverPos.worldZ,
                height: this.config.heightInWater ?? 0.0,
                rotation: Math.random() * Math.PI * 2,
                normal: new THREE.Vector3(0, 1, 0)
            };

            return this.createEntity(context, {
                x: placement.worldX,
                y: placement.worldZ,
                angle: fixedAngle !== undefined ? fixedAngle : placement.rotation,
                height: fixedHeight !== undefined ? fixedHeight : placement.height,
                terrainNormal: placement.normal,
                aggressiveness,
                behavior: finalBehavior,
                disableLogic,
                zRange: options.biomeZRange
            });
        }
        return false;
    }

    public createEntity(context: SpawnContext, options: AnimalOptions) {
        const entity = this.config.factory(context.physicsEngine, options);
        if (entity) {
            context.entityManager.add(entity);
            return true;
        }
        return false;
    }
}
