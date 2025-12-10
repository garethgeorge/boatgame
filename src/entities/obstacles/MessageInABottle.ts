import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

export class MessageInABottle extends Entity {

    private floatOffset: number = Math.random() * Math.PI * 2;
    public points: number;
    public color: number;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, color: number = 0x88FF88, points: number = 100) {
        super();
        this.points = points;
        this.color = color;

        const physicsBody = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y)
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Circle(0.4),
            isSensor: true
        });

        physicsBody.setUserData({ type: 'collectable', subtype: 'bottle', entity: this });

        // Graphics
        const mesh = Decorations.getBottleMesh(color);
        this.meshes.push(mesh);

        // Tilt the whole group

        // Tilt the whole group
        mesh.rotation.x = Math.PI / 4;
        mesh.rotation.z = Math.PI / 6;
    }

    update(dt: number) {
        if (this.physicsBodies.length === 0) {
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.position.y += dt * 10; // 5x faster (was 2)
                mesh.rotation.y += dt * 25; // 5x faster (was 5)

                // Fade out
                mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const mat = child.material as THREE.Material;
                        if (mat) {
                            mat.transparent = true;
                            if (mat.opacity > 0) {
                                mat.opacity -= dt * 2.0; // Fade out speed
                            }
                        }
                    }
                });

                if (mesh.position.y > 5) {
                    this.shouldRemove = true;
                }
            }
            return;
        }

        this.floatOffset += dt * 1.5;
        if (this.meshes.length > 0) {
            const mesh = this.meshes[0];
            // Raise by 50% of height (height is ~2.0 now). +1.0 base?
            // User said "float ~50% of it's height heigher".
            // Previous base was implicit 0? No, cylinder center is 0.
            // Let's add +1.0 to y.
            mesh.position.y = Math.sin(this.floatOffset) * 0.1 + 1.0;
            mesh.rotation.y += dt * 0.5;
            mesh.rotation.z = Math.sin(this.floatOffset * 0.5) * 0.2; // Bobbing tilt
        }
    }

    onHit() {
        this.shouldRemove = true;
    }
}
