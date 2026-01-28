import * as THREE from 'three';
import { SpawnContext } from '../Spawnable';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { ShorePlacementOptions } from '../../managers/PlacementHelper';
import { RiverGeometry, RiverGeometrySample } from '../../world/RiverGeometry';
import { AnimalSpawner, AnimalSpawnOptions } from './AnimalSpawner';
import { ShoreAnimalOptions } from '../obstacles/ShoreAnimal';
import { RiverSystem } from '../../world/RiverSystem';
import { DecorationId, Decorations } from '../../world/Decorations';

export interface ShoreAnimalSpawnConfig {
    id: string;
    decorationIds: DecorationId[];
    getDensity: (difficulty: number, zStart: number) => number;
    factory: (physicsEngine: PhysicsEngine, options: ShoreAnimalOptions) => Entity;
    entityRadius?: number;
    shorePlacement?: ShorePlacementOptions;
}

export class ShoreAnimalSpawner extends AnimalSpawner {
    private config: ShoreAnimalSpawnConfig;

    constructor(config: ShoreAnimalSpawnConfig) {
        super();
        this.config = config;
    }

    get id(): string {
        return this.config.id;
    }

    protected get entityRadius(): number {
        return this.config.entityRadius ?? 2.0;
    }

    protected get shorePlacement(): ShorePlacementOptions {
        return this.config.shorePlacement ?? { minDistFromBank: 3.0, maxDistFromBank: 8.0 };
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

        const aggro = Math.random();
        const shorePlace = this.shorePlacement;
        const left = Math.random() < 0.5;
        const range: [number, number] = left ?
            [-sample.bankDist - (shorePlace.maxDistFromBank || 8.0), -sample.bankDist] :
            [sample.bankDist, sample.bankDist + (shorePlace.maxDistFromBank || 8.0)];

        return this.spawnAnimalAbsolute({ context, sample, distanceRange: range, aggressiveness: aggro, biomeZRange });
    }

    /**
     * Spawns an animal at an absolute shore position.
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

        const radius = this.entityRadius;
        const minSpacing = 4.0;
        const minShoreDist = this.shorePlacement.minDistFromBank || 2.0;
        const maxSlopeDegrees = this.shorePlacement.maxSlopeDegrees || 30.0;

        const placement = context.placementHelper.tryShorePlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minShoreDist,
            distanceRange,
            maxSlopeDegrees
        );

        if (placement) {
            const entity = this.config.factory(context.physicsEngine, {
                x: placement.worldX,
                y: placement.worldZ,
                height: fixedHeight !== undefined ? fixedHeight : placement.height,
                angle: fixedAngle !== undefined ? fixedAngle : placement.rotation,
                terrainNormal: placement.normal,
                aggressiveness,
                shoreBehavior: 'none',
                disableLogic,
                zRange: options.biomeZRange
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }
}
