import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { PhysicsEngine } from '../core/PhysicsEngine';

export class GasCan extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Group;
  private floatOffset: number = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
    super();

    this.physicsBody = physicsEngine.world.createBody({
      type: 'static', // Static sensor
      position: planck.Vec2(x, y)
    });

    this.physicsBody.createFixture({
      shape: planck.Box(0.5, 0.5),
      isSensor: true
    });

    this.physicsBody.setUserData({ type: 'collectable', subtype: 'gas', entity: this });

    // Graphics
    this.mesh = new THREE.Group();

    // Main Body
    const geo = new THREE.BoxGeometry(1.2, 1.6, 0.8); // Doubled
    const mat = new THREE.MeshToonMaterial({ color: 0xFF0000 }); // Red
    const can = new THREE.Mesh(geo, mat);
    can.position.y = 0.8;
    this.mesh.add(can);

    // Handle
    const handleGeo = new THREE.TorusGeometry(0.3, 0.1, 8, 16); // Doubled
    const handleMat = new THREE.MeshToonMaterial({ color: 0xFF0000 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 1.8;
    // Fix rotation: was Math.PI / 2 (90 deg), user says off by 90.
    // Torus default is flat on XY plane.
    // If we want it upright like a suitcase handle?
    // Let's try 0 or PI.
    handle.rotation.y = 0;
    this.mesh.add(handle);

    // Spout
    const spoutGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.6, 8); // Doubled
    const spoutMat = new THREE.MeshToonMaterial({ color: 0xFFD700 }); // Yellow
    const spout = new THREE.Mesh(spoutGeo, spoutMat);
    spout.position.set(0.4, 1.6, 0);
    spout.rotation.z = -Math.PI / 4;
    this.mesh.add(spout);
  }

  onHit() {
    if (this.physicsBody) {
      this.physicsBody.getWorld().destroyBody(this.physicsBody);
      this.physicsBody = null;
    }
  }

  update(dt: number) {
    if (!this.physicsBody) {
      // Floating up animation
      if (this.mesh) {
        this.mesh.position.y += dt * 2;
        this.mesh.rotation.y += dt * 5;
        // Fade out? Hard to do with Group materials easily without iterating
        // Just float up high enough then remove
        if (this.mesh.position.y > 5) {
          this.shouldRemove = true;
        }
      }
      return;
    }

    // Float animation
    this.floatOffset += dt * 2;
    if (this.mesh) {
      this.mesh.position.y = Math.sin(this.floatOffset) * 0.2 + 0.5; // +0.5 base height
      this.mesh.rotation.y += dt;
    }
  }
}

export class MessageInABottle extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Group;
  private floatOffset: number = Math.random() * Math.PI * 2;
  public points: number;

  constructor(x: number, y: number, physicsEngine: PhysicsEngine, color: number = 0x88FF88, points: number = 100) {
    super();
    this.points = points;

    this.physicsBody = physicsEngine.world.createBody({
      type: 'static',
      position: planck.Vec2(x, y)
    });

    this.physicsBody.createFixture({
      shape: planck.Circle(0.4),
      isSensor: true
    });

    this.physicsBody.setUserData({ type: 'collectable', subtype: 'bottle', entity: this });

    // Graphics
    this.mesh = new THREE.Group();

    // Bottle Body
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8); // Doubled
    const glassMat = new THREE.MeshToonMaterial({
      color: color,
      transparent: true,
      opacity: 0.6
    });
    const body = new THREE.Mesh(bodyGeo, glassMat);
    this.mesh.add(body);

    // Bottle Neck
    const neckGeo = new THREE.CylinderGeometry(0.2, 0.4, 0.6, 8); // Doubled
    const neck = new THREE.Mesh(neckGeo, glassMat);
    neck.position.y = 0.9;
    this.mesh.add(neck);

    // Cork
    const corkGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.3, 8); // Doubled
    const corkMat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
    const cork = new THREE.Mesh(corkGeo, corkMat);
    cork.position.y = 1.3;
    this.mesh.add(cork);

    // Paper Message
    const paperGeo = new THREE.PlaneGeometry(0.3, 0.6); // Doubled
    const paperMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
    const paper = new THREE.Mesh(paperGeo, paperMat);
    paper.rotation.y = Math.PI / 4;
    paper.rotation.z = Math.PI / 8;
    this.mesh.add(paper);

    // Tilt the whole group
    this.mesh.rotation.x = Math.PI / 4;
    this.mesh.rotation.z = Math.PI / 6;
  }

  update(dt: number) {
    if (!this.physicsBody) {
      if (this.mesh) {
        this.mesh.position.y += dt * 10; // 5x faster (was 2)
        this.mesh.rotation.y += dt * 25; // 5x faster (was 5)

        // Fade out
        this.mesh.traverse((child) => {
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

        if (this.mesh.position.y > 5) {
          this.shouldRemove = true;
        }
      }
      return;
    }

    this.floatOffset += dt * 1.5;
    if (this.mesh) {
      // Raise by 50% of height (height is ~2.0 now). +1.0 base?
      // User said "float ~50% of it's height heigher".
      // Previous base was implicit 0? No, cylinder center is 0.
      // Let's add +1.0 to y.
      this.mesh.position.y = Math.sin(this.floatOffset) * 0.1 + 1.0;
      this.mesh.rotation.y += dt * 0.5;
      this.mesh.rotation.z = Math.sin(this.floatOffset * 0.5) * 0.2; // Bobbing tilt
    }
  }

  onHit() {
    if (this.physicsBody) {
      this.physicsBody.getWorld().destroyBody(this.physicsBody);
      this.physicsBody = null;
    }
  }
}
