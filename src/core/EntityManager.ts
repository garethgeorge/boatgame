import * as THREE from 'three';
import { Entity } from '../entities/Entity';
import { PhysicsEngine } from './PhysicsEngine';
import { GraphicsEngine } from './GraphicsEngine';
import * as planck from 'planck';
import { DesignerSettings } from './DesignerSettings';

export class EntityManager {
    entities: Set<Entity> = new Set();
    physicsEngine: PhysicsEngine;
    graphicsEngine: GraphicsEngine;

    debugMode: boolean = false;

    constructor(physicsEngine: PhysicsEngine, graphicsEngine: GraphicsEngine) {
        this.physicsEngine = physicsEngine;
        this.graphicsEngine = graphicsEngine;
    }

    setDebug(enabled: boolean) {
        if (this.debugMode === enabled) return;
        this.debugMode = enabled;
        for (const entity of this.entities) {
            const debugMeshes = entity.ensureDebugMeshes();
            for (const debugMesh of debugMeshes) {
                if (this.debugMode) {
                    this.graphicsEngine.add(debugMesh);
                } else {
                    this.graphicsEngine.remove(debugMesh);
                }
            }
            if (!this.debugMode) {
                entity.destroyDebugMeshes();
            }
        }
    }

    // Note: only pass null for entities that should never be
    // removed from the scene.
    add(entity: Entity) {
        this.entities.add(entity);

        // Sync immediately so meshes are correctly positioned before being added to the scene
        entity.updateVisuals(0, 1.0);

        // Planck bodies are added to world upon creation, so no need to add here.
        for (const mesh of entity.meshes) {
            this.graphicsEngine.add(mesh);
        }

        if (this.debugMode) {
            const debugMeshes = entity.ensureDebugMeshes();
            for (const debugMesh of debugMeshes) {
                this.graphicsEngine.add(debugMesh);
            }
        }
    }

    remove(entity: Entity) {
        if (this.entities.has(entity)) {
            this.entities.delete(entity);

            for (const body of entity.physicsBodies) {
                this.physicsEngine.world.destroyBody(body);
            }

            for (const mesh of entity.meshes) {
                this.graphicsEngine.remove(mesh);
            }

            for (const debugMesh of entity.debugMeshes) {
                this.graphicsEngine.remove(debugMesh);
            }

            entity.dispose();
        }
    }

    removeEntitiesInRange(zMin: number, zMax: number) {
        // chunk width is 400 so 10000 should be more than enough
        const aabb = {
            lowerBound: planck.Vec2(-10000, zMin),
            upperBound: planck.Vec2(10000, zMax)
        };

        const entitiesToRemove = new Set<Entity>();
        this.physicsEngine.world.queryAABB(aabb, (fixture) => {
            const body = fixture.getBody();
            const userData = body.getUserData() as any;
            if (userData && userData.entity && userData.type !== 'player') {
                entitiesToRemove.add(userData.entity);
            }
            return true; // continue query
        });

        for (const entity of entitiesToRemove) {
            this.remove(entity);
        }

        console.log('Removed entities:', entitiesToRemove.size, 'current:', this.entities.size);
    }

    savePreviousState() {
        for (const entity of this.entities) {
            entity.savePreviousState();
        }
    }

    updateLogic(dt: number) {
        const entitiesArray = Array.from(this.entities);

        const shouldUpdateEntity = (entity: Entity) => {
            const isPlayer = entity.physicsBodies.length > 0 &&
                (entity.physicsBodies[0].getUserData() as any)?.type === Entity.TYPE_PLAYER;

            return entity.isVisible || isPlayer || DesignerSettings.isDesignerMode;
        }

        // Logic Pass (Compute) - Non-hierarchical as it's read-only
        for (const entity of entitiesArray) {
            if (shouldUpdateEntity(entity)) {
                entity.update(dt);
            }
        }
    }

    applyUpdates(dt: number) {
        const shouldUpdateEntity = (entity: Entity) => {
            const isPlayer = entity.physicsBodies.length > 0 &&
                (entity.physicsBodies[0].getUserData() as any)?.type === Entity.TYPE_PLAYER;

            return entity.isVisible || isPlayer || DesignerSettings.isDesignerMode;
        }

        // Application Pass (Hierarchical)
        const applyRecursive = (entity: Entity) => {
            if (shouldUpdateEntity(entity)) {
                entity.applyUpdate(dt);
            }

            for (const child of entity.children()) {
                applyRecursive(child);
            }
        };

        for (const entity of this.entities) {
            const parent = entity.parent();
            if (!parent || !this.entities.has(parent)) {
                applyRecursive(entity);
            }
        }

        // Handle removals after apply pass
        const entitiesArray = Array.from(this.entities);
        for (const entity of entitiesArray) {
            if (entity.shouldRemove) {
                this.remove(entity);
            }
        }
    }

    updateVisuals(dt: number, alpha: number) {
        const shouldUpdateEntity = (entity: Entity) => {
            const isPlayer = entity.physicsBodies.length > 0 &&
                (entity.physicsBodies[0].getUserData() as any)?.type === Entity.TYPE_PLAYER;

            return entity.isVisible || isPlayer || DesignerSettings.isDesignerMode;
        }

        // Visuals Pass (Hierarchical)
        const visualsRecursive = (entity: Entity) => {
            if (shouldUpdateEntity(entity)) {
                entity.updateVisuals(dt, alpha);
            }

            for (const child of entity.children()) {
                visualsRecursive(child);
            }
        };

        for (const entity of this.entities) {
            const parent = entity.parent();
            if (!parent || !this.entities.has(parent)) {
                visualsRecursive(entity);
            }
        }
    }

    public updateVisibility(cameraPos: THREE.Vector3, cameraDir: THREE.Vector3) {
        if (DesignerSettings.isDesignerMode) return;

        const visibilityRadius = 360;
        const dotBuffer = -20; // Entities are small, smaller buffer than chunks

        for (const entity of this.entities) {
            if (entity.physicsBodies.length === 0) continue;

            // Use physics position instead of mesh position because sync() might be skipped
            const bodyPos = entity.physicsBodies[0].getPosition();
            const entityX = bodyPos.x;
            const entityZ = bodyPos.y; // Physics Y is Graphics Z
            const entityPos = new THREE.Vector3(entityX, 0, entityZ);

            // Distance check
            const dist = cameraPos.distanceTo(entityPos);

            if (dist > visibilityRadius) {
                entity.setVisible(false);
                continue;
            }

            // Tiered Throttling
            if (dist < 50) {
                entity.setAnimationThrottle(1);
            } else if (dist < 100) {
                entity.setAnimationThrottle(3);
            } else {
                entity.setAnimationThrottle(6);
            }

            // Direction check (dot product)
            const toEntity = entityPos.clone().sub(cameraPos);
            const dot = toEntity.dot(cameraDir);

            if (DesignerSettings.isDesignerMode) {
                entity.setVisible(true);
                entity.setAnimationThrottle(1);
            } else {
                if (dot < dotBuffer) {
                    entity.setVisible(false);
                } else {
                    entity.setVisible(true);
                }
            }
        }
    }

    public getEntityStats(): Map<string, number> {
        const stats = new Map<string, number>();
        for (const entity of this.entities) {
            let type = 'unknown';
            if (entity.physicsBodies.length > 0) {
                const userData = entity.physicsBodies[0].getUserData() as any;
                if (userData) {
                    type = userData.subtype || userData.type || 'unknown';
                }
            }

            stats.set(type, (stats.get(type) || 0) + 1);
        }
        return stats;
    }
}
