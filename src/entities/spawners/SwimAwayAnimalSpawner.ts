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

    protected getDensity(difficulty: number, zStart: number): number {
        return this.config.getDensity(difficulty, zStart);
    }

    async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
        const radius = this.entityRadius;

        const pos = context.placementHelper.tryPlace(z, z, radius, this.waterPlacement);

        if (pos) {
            const angle = Math.random() * Math.PI * 2;
            const entity = this.config.factory(context.physicsEngine, {
                x: pos.x,
                y: pos.z,
                height: 0,
                angle: angle
            });
            context.entityManager.add(entity);

            return true;
        }
        return false;
    }

    /**
     * Spawns an animal at an absolute river position.
     */
    async spawnAnimalAbsolute(options: AnimalSpawnOptions): Promise<boolean> {
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
                height: fixedHeight !== undefined ? fixedHeight : 0,
                angle: fixedAngle !== undefined ? fixedAngle : Math.random() * Math.PI * 2,
                aggressiveness,
                disableLogic
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }
}
