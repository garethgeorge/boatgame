import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { PlacementHelper } from '../managers/PlacementHelper';

export interface SpawnContext {
  entityManager: EntityManager;
  physicsEngine: PhysicsEngine;
  placementHelper: PlacementHelper;
}
