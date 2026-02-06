import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { Decorations } from '../../world/decorations/Decorations';

export class RiverRock extends Entity {

    constructor(x: number, y: number, radius: number, hasPillars: boolean, biome: string,
        physicsEngine: PhysicsEngine) {
        super();

        // Physics: Static
        const physicsBody = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            angle: Math.random() * Math.PI * 2
        });
        this.physicsBodies.push(physicsBody);

        // Circle shape for physics - slightly larger than radius to account for clusters
        physicsBody.createFixture({
            shape: planck.Circle(radius * 1.1),
            friction: 0.5,
            restitution: 0.2
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'rock', entity: this });

        // Graphics: Rock Cluster from Factory
        const group = Decorations.getRiverRock(radius, hasPillars, biome);
        this.meshes.push(group as any);

        // Parent group needs to be tracked too
        GraphicsUtils.registerObject(group);
    }

    wasHitByPlayer() {
        // Solid
    }

    update(dt: number) {
        // Static
    }
}
