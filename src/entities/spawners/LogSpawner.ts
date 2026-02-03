import { SpawnContext } from '../Spawnable';
import { Log } from '../../entities/obstacles/Log';

export class LogSpawner {

  public static createEntity(context: SpawnContext, x: number, z: number, length: number) {
    const log = new Log(x, z, length, context.physicsEngine);
    context.entityManager.add(log);
  }

}
