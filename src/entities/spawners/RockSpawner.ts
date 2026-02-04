import * as THREE from 'three';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { BiomeType } from '../../world/biomes/BiomeType';
import { RiverRock } from '../obstacles/RiverRock';

export class RockSpawner {
  public static createEntity(
    context: PopulationContext,
    x: number, z: number, radius: number,
    pillars: boolean, rockBiome: BiomeType
  ) {
    const rock = new RiverRock(x, z, radius, pillars, rockBiome, context.physicsEngine);
    context.entityManager.add(rock);
  }
}
