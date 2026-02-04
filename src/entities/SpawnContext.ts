import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';

export interface SpawnContext {
  entityManager: EntityManager;
  physicsEngine: PhysicsEngine;
}
