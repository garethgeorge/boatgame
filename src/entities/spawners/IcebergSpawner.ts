import { PopulationContext } from '../../world/biomes/PopulationContext';
import { Iceberg } from '../../entities/obstacles/Iceberg';
import { Decorations } from '../../world/decorations/Decorations';

export class IcebergSpawner {
    id = 'iceberg';

    public static createEntity(
        context: PopulationContext,
        x: number, z: number, radius: number
    ) {
        const iceberg = new Iceberg(x, z, radius, context.physicsEngine);
        context.entityManager.add(iceberg);
    }
}
