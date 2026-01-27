import * as THREE from 'three';
import { DecorationId, Decorations } from '../../world/Decorations';
import { Spawnable, SpawnContext } from '../Spawnable';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverGeometry, RiverGeometrySample } from '../../world/RiverGeometry';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AttackAnimalBehavior, AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions, ShorePlacementOptions } from '../../managers/PlacementHelper';
import { AnimalSpawner, AnimalSpawnOptions } from './AnimalSpawner';

export interface AttackAnimalSpawnConfig {
    id: string;
    decorationIds: DecorationId[];
    getDensity: (difficulty: number, zStart: number) => number;
    factory: (physicsEngine: PhysicsEngine, options: AttackAnimalOptions) => Entity;
    shoreProbability?: number;
    entityRadius?: number;
    heightInWater?: number;
    waterPlacement?: RiverPlacementOptions;
    shorePlacement?: ShorePlacementOptions;
    shoreBehavior?: AttackAnimalBehavior;
}

export class AttackAnimalSpawner extends AnimalSpawner {
    private config: AttackAnimalSpawnConfig;

    constructor(config: AttackAnimalSpawnConfig) {
        super();
        this.config = config;
    }

    get id(): string {
        return this.config.id;
    }

    protected getDensity(difficulty: number, zStart: number): number {
        return this.config.getDensity(difficulty, zStart);
    }

    protected get entityRadius(): number {
        return this.config.entityRadius ?? 5.0;
    }

    protected get shoreProbability(): number {
        return this.config.shoreProbability ?? 0.0;
    }
    protected get shorePlacement(): ShorePlacementOptions {
        return this.config.shorePlacement ?? { minDistFromBank: 3.0, maxDistFromBank: 6.0 };
    }
    protected get shoreBehavior(): AttackAnimalBehavior {
        return this.config.shoreBehavior ?? 'wait';
    };

    protected get heightInWater(): number {
        return this.config.heightInWater ?? 0.0;
    }
    protected get waterPlacement(): RiverPlacementOptions {
        return this.config.waterPlacement ?? {};
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: AttackAnimalOptions): Entity {
        return this.config.factory(physicsEngine, options);
    }

    *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* Decorations.ensureAllLoaded(this.config.decorationIds);
    }

    spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
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
            return this.spawnAnimalAbsolute({ context, sample, distanceRange: range, aggressiveness: aggro, biomeZRange });
        } else {
            const range: [number, number] = [-sample.bankDist, sample.bankDist];
            return this.spawnAnimalAbsolute({ context, sample, distanceRange: range, aggressiveness: aggro, biomeZRange });
        }
    }

    /**
     * Spawns an animal within a distance range from a river position.
     * If the range includes the shore prefers finding an on shore
     * position. 
     */
    spawnAnimalAbsolute(options: AnimalSpawnOptions): boolean {
        const {
            context,
            sample,
            distanceRange,
            aggressiveness,
            logic,
            disableLogic,
            fixedAngle,
            fixedHeight
        } = options;

        let placement: any = null;

        const radius = this.entityRadius;
        const minSpacing = this.waterPlacement.minDistFromOthers || 2.0;
        const minWaterDist = this.waterPlacement.minDistFromBank || 2.0;
        const minShoreDist = this.shorePlacement.minDistFromBank || 2.0;
        const maxSlopeDegrees = this.shorePlacement.maxSlopeDegrees || 20.0;

        // Check if range overlaps shore
        const overlapsShore = distanceRange[0] < -sample.bankDist - minShoreDist || distanceRange[1] > sample.bankDist + minShoreDist;

        let behavior: AttackAnimalBehavior = this.shoreBehavior;
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
            behavior = 'attack';
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
                attackLogicName: logic,
                attackBehavior: behavior,
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

