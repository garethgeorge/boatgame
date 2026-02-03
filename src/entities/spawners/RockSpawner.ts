import * as THREE from 'three';
import { SpawnContext } from '../SpawnContext';
import { RiverRock } from '../../entities/obstacles/RiverRock';

export class RockSpawner {
  public static createEntity(
    context: SpawnContext,
    x: number, z: number, radius: number,
    pillars: boolean, biome: string
  ) {
    const rock = new RiverRock(x, z, radius, pillars, biome, context.physicsEngine);
    context.entityManager.add(rock);
  }
}
