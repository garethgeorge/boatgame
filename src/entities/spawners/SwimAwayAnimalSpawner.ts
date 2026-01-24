import { SpawnContext } from '../Spawnable';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';
import { RiverGeometrySample } from '../../world/RiverGeometry';
import { AnimalSpawner, AnimalSpawnOptions } from './AnimalSpawner';
import { SwimAwayAnimalOptions } from '../obstacles/SwimAwayAnimal';

export interface SwimAwayAnimalSpawnConfig {
    id: string;
    getDensity: (difficulty: number, zStart: number) => number;
    factory: (physicsEngine: PhysicsEngine, options: SwimAwayAnimalOptions) => Entity;
    heightInWater: number;
    entityRadius?: number;
    waterPlacement?: RiverPlacementOptions;
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
        const radius = this.entityRadius;

        const pos = context.placementHelper.tryPlace(z, z, radius, this.waterPlacement);

        if (pos) {
            const angle = Math.random() * Math.PI * 2;
            const entity = this.config.factory(context.physicsEngine, {
                x: pos.x,
                y: pos.z,
                height: this.heightInWater,
                angle: angle,
                zRange: [context.biomeZMin, context.biomeZMax]
            });
            context.entityManager.add(entity);

            return true;
        }
        return false;
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

        const radius = this.entityRadius;
        const minSpacing = this.waterPlacement.minDistFromOthers || 2.0;
        const minWaterDist = this.waterPlacement.minDistFromBank || 1.0;

        const riverPos = context.placementHelper.tryRiverPlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minWaterDist,
            distanceRange
        );

        if (riverPos) {
            const entity = this.config.factory(context.physicsEngine, {
                x: riverPos.worldX,
                y: riverPos.worldZ,
                height: fixedHeight !== undefined ? fixedHeight : this.heightInWater,
                angle: fixedAngle !== undefined ? fixedAngle : Math.random() * Math.PI * 2,
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
