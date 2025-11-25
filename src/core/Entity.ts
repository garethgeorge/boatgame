import Matter from 'matter-js';
import * as THREE from 'three';

export abstract class Entity {
  physicsBody: Matter.Body | null = null;
  mesh: THREE.Object3D | null = null;

  constructor() { }

  abstract update(dt: number): void;

  // Sync graphics position/rotation with physics body
  sync() {
    if (this.physicsBody && this.mesh) {
      this.mesh.position.x = this.physicsBody.position.x;
      this.mesh.position.z = this.physicsBody.position.y; // Map 2D Physics Y to 3D Graphics Z
      // Physics Y is usually 'down' in 2D, but in 3D top-down, Z is 'down/forward'. 
      // We'll assume standard mapping: x=x, y=z.

      this.mesh.rotation.y = -this.physicsBody.angle; // Invert angle if needed depending on coordinate systems
    }
  }
}
