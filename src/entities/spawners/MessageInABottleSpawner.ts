import { SpawnContext } from '../Spawnable';
import { MessageInABottle } from '../../entities/obstacles/MessageInABottle';
import { RiverSystem } from '../../world/RiverSystem';

export class MessageInABottleSpawner {

  public static spawnBonusArc(context: SpawnContext, zStart: number, zEnd: number) {
    const riverSystem = RiverSystem.getInstance();
    const worldZ = zStart + Math.random() * (zEnd - zStart - 60); // Ensure space for arc

    const count = 8;
    const arcLength = 60;
    const spacing = arcLength / count;
    const riverWidth = riverSystem.getRiverWidth(worldZ);
    const amplitude = riverWidth * 0.15;
    const frequency = Math.PI / arcLength;
    const phase = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const dz = i * spacing;
      const currentZ = worldZ + dz;
      const currentCenter = riverSystem.getRiverCenter(currentZ);
      const offsetX = Math.sin(dz * frequency + phase) * amplitude;

      // No collision check for bonus arc (they are collectibles, can overlap obstacles slightly or just be placed)
      // But better to check?
      // Let's just place them.
      this.createEntity(context, currentCenter + offsetX, currentZ, 0x0088FF, 50);
    }
  }

  public static createEntity(
    context: SpawnContext, x: number, z: number, color?: number, points?: number
  ) {
    const bottle = new MessageInABottle(x, z, context.physicsEngine, color, points);
    context.entityManager.add(bottle);
  }
}
