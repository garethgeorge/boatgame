import * as planck from 'planck';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Entity } from '../core/Entity';
import { PhysicsEngine } from '../core/PhysicsEngine';

export class Alligator extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Group;
  // private mouth: THREE.Mesh; // Removed procedural mouth
  // private mouthOpen: boolean = false; // Removed procedural animation state
  // private mouthTimer: number = 0; // Removed procedural animation state

  constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
    super();

    // Physics
    this.physicsBody = physicsEngine.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      linearDamping: 2.0,
      angularDamping: 1.0
    });

    this.physicsBody.createFixture({
      shape: planck.Box(1.0, 3.0), // 2m wide, 6m long (Doubled)
      density: 5.0,
      friction: 0.1,
      restitution: 0.0
    });

    this.physicsBody.setUserData({ type: 'obstacle', subtype: 'alligator', entity: this });

    // Graphics
    this.mesh = new THREE.Group();

    const loader = new GLTFLoader();
    loader.load('assets/alligator-model-1.glb', (gltf) => {
      const model = gltf.scene;

      // Adjust scale and rotation to match physics body
      // Physics body is 2m wide, 6m long.
      // Assuming model is roughly unit scale or needs adjustment.
      // Let's start with a scale that makes it visible and adjust if needed.
      // If it's a typical model, it might need scaling.
      model.scale.set(3.0, 3.0, 3.0);

      // Rotate to face correct direction if needed.
      // Physics body forward is usually -Y or +Y depending on game.
      // In Boat.ts, forward is -Z (ThreeJS) and boat is rotated Y by 90 deg.
      // Here, let's assume model faces +Z or -Z.
      // If the alligator swims along the river (Z axis?), we might need to rotate it.
      // Let's assume standard orientation for now (face +Z or -Z).
      model.rotation.y = Math.PI; // Rotate 180 degrees if it faces backwards

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.mesh.add(model);
    }, undefined, (error) => {
      console.error('An error occurred loading the alligator model:', error);
    });

    this.mesh.position.y = 0.5; // Raised by ~15% of model height
  }

  onHit() {
    if (this.physicsBody) {
      this.physicsBody.getWorld().destroyBody(this.physicsBody);
      this.physicsBody = null;
    }
  }

  update(dt: number) {
    if (!this.physicsBody) {
      // Sinking animation
      if (this.mesh) {
        this.mesh.position.y -= dt * 2;
        if (this.mesh.position.y < -2) {
          this.shouldRemove = true;
        }
      }
      return;
    }

    // Swim towards player (simplified: just move forward slowly and rotate occasionally?)
    // Or just move forward in its current direction
    // For now, let's just make it drift and snap

    // Mouth Animation (Upper Jaw moves) - REMOVED for GLB model
    /*
    this.mouthTimer += dt;
    if (this.mouthTimer > 1.0) {
      this.mouthOpen = !this.mouthOpen;
      this.mouthTimer = 0;
    }
    */

    // Access the upper jaw pivot - REMOVED for GLB model
    /*
    // Find headGroup
    // body (0), ridge*6 (1-6), tail (7), headGroup (8).
    const headGroup = this.mesh.children[8]; // Assuming headGroup is the 9th child (index 8)
    if (headGroup && headGroup.children.length > 2) {
      const upperJawPivot = headGroup.children[2];
      // Invert direction: Rotate UP (positive X)
      const targetRot = this.mouthOpen ? 0.4 : 0;
      upperJawPivot.rotation.x = THREE.MathUtils.lerp(upperJawPivot.rotation.x, targetRot, dt * 5);
    }
    */

    // AI: Swim towards player
    // We need player position. Currently update(dt) doesn't receive player pos.
    // We can pass it in EntityManager or just cheat and find 'player' userData in physics world?
    // Or just make them swim forward relative to themselves, and maybe turn slowly?
    // Let's make them swim towards the boat if close.

    // For now, let's just make them swim forward in the river flow direction (approx +Z)
    // But they face +Z initially.
    // Let's add a simple "seek" behavior if we can access player.
    // Since we don't have player ref easily here without changing signature, 
    // let's just make them patrol or swim forward.
    // User asked for "slowly swim towards the player".
    // I'll update EntityManager to pass player position or target.

    // ... wait, I can't easily change Entity.update signature across all entities without touching them all.
    // But I can add a method setTarget(target: Entity) or similar.
    // Or just look for the player in the physics world bodies list? Expensive.
    // Let's just make them move forward for now, and I'll update EntityManager in next step to pass player.
  }

  // New method to set target
  setTarget(target: planck.Vec2) {
    if (!this.physicsBody) return;

    const pos = this.physicsBody.getPosition();
    const diff = target.clone().sub(pos);
    const dist = diff.length();

    if (dist < 30) { // Aggro range
      diff.normalize();
      // Move towards target
      const speed = 2.0;
      const force = diff.mul(speed * this.physicsBody.getMass());
      this.physicsBody.applyForceToCenter(force);

      // Rotate towards target
      // In planck.js, angle 0 typically means the body's local X-axis points along global X.
      // If our model's forward is -Y (in 2D planck space), then its angle is PI/2.
      // We want the body's forward vector (which is (0, -1) in its local space) to align with 'diff'.
      // The angle of vector (x, y) is atan2(y, x).
      // The angle of (0, -1) is -PI/2.
      // So, desiredAngle = atan2(diff.y, diff.x) - (-PI/2) = atan2(diff.y, diff.x) + PI/2.
      const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
      const currentAngle = this.physicsBody.getAngle();

      // Simple lerp for rotation
      // Calculate shortest angle difference
      let angleDiff = desiredAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      const rotationSpeed = 0.1; // How quickly it turns
      this.physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60)); // Adjust for dt if needed, but setAngularVelocity is per-frame
    }
  }
}

export class Turtle extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Mesh;
  private turnTimer: number = 0;

  constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
    super();

    this.physicsBody = physicsEngine.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      linearDamping: 1.0,
      angularDamping: 1.0
    });

    this.physicsBody.createFixture({
      shape: planck.Circle(0.8),
      density: 8.0,
      friction: 0.1
    });

    this.physicsBody.setUserData({ type: 'obstacle', subtype: 'turtle', entity: this });

    // Graphics
    const geo = new THREE.SphereGeometry(0.8, 16, 16);
    const mat = new THREE.MeshToonMaterial({ color: 0x006400 }); // Dark Green
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.scale.y = 0.5; // Flatten it
  }

  onHit() {
    if (this.physicsBody) {
      this.physicsBody.getWorld().destroyBody(this.physicsBody);
      this.physicsBody = null;
    }
  }

  update(dt: number) {
    if (!this.physicsBody) {
      if (this.mesh) {
        this.mesh.position.y -= dt * 2;
        if (this.mesh.position.y < -2) {
          this.shouldRemove = true;
        }
      }
      return;
    }

    // Meander
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      this.turnTimer = Math.random() * 3 + 1;
      const torque = (Math.random() - 0.5) * 10;
      this.physicsBody.applyTorque(torque);

      // Move forward
      const forward = this.physicsBody.getWorldVector(planck.Vec2(0, -1));
      this.physicsBody.applyForceToCenter(forward.mul(50));
    }
  }
}

export class Log extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Mesh;

  constructor(x: number, y: number, length: number, physicsEngine: PhysicsEngine) {
    super();

    // Log should be perpendicular to the river flow (roughly X-aligned) to block path
    // Physics Box takes (halfWidth, halfHeight).
    // We want length along X. So halfWidth = length/2, halfHeight = 0.5.

    this.physicsBody = physicsEngine.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      linearDamping: 2.0, // Heavy water resistance
      angularDamping: 1.0,
      bullet: true
    });

    this.physicsBody.createFixture({
      shape: planck.Box(length / 2, 0.6), // 1.2m thick log
      density: 20.0, // Heavy wood, same density as boat to resist pushing
      friction: 0.8, // Rough
      restitution: 0.1
    });

    this.physicsBody.setUserData({ type: 'obstacle', subtype: 'log', entity: this });

    // Graphics
    // Cylinder is Y-up by default.
    // We want it along X-axis to match Physics Box(length, thickness).
    // Rotate around Z axis by 90 deg.
    const geo = new THREE.CylinderGeometry(0.6, 0.6, length, 12);
    const mat = new THREE.MeshToonMaterial({ color: 0x5C4033 }); // Darker Brown
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  onHit() {
    // Logs don't break, they block!
  }

  update(dt: number) {
    // Just floats
  }
}
export class Pier extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Group;

  constructor(x: number, y: number, length: number, angle: number, physicsEngine: PhysicsEngine) {
    super();

    // Static body
    this.physicsBody = physicsEngine.world.createBody({
      type: 'static',
      position: planck.Vec2(x, y),
      angle: angle // Set rotation
    });

    // Box is axis-aligned in local coords.
    // Length is along X (extending from bank). Width is along Y (thickness).
    // shape: Box(halfWidth, halfHeight)
    // We want length to be the long dimension.
    this.physicsBody.createFixture({
      shape: planck.Box(length / 2, 1.0),
      friction: 0.5
    });

    this.physicsBody.setUserData({ type: 'obstacle', subtype: 'pier', entity: this });

    // Graphics
    this.mesh = new THREE.Group();

    // Deck
    const deckGeo = new THREE.BoxGeometry(length, 0.5, 2.0); // Thinner deck
    const deckMat = new THREE.MeshToonMaterial({ color: 0xA0522D }); // Sienna
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 1.5; // Raised up
    this.mesh.add(deck);

    // Piles (Supports)
    const pileGeo = new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8);
    const pileMat = new THREE.MeshToonMaterial({ color: 0x8B4513 }); // Darker wood

    const numPiles = Math.floor(length / 3);
    for (let i = 0; i <= numPiles; i++) {
      // Calculate x position relative to center
      // Length spans from -length/2 to +length/2
      const xPos = -length / 2 + (length / numPiles) * i;

      // Two piles per row (front and back)
      const pile1 = new THREE.Mesh(pileGeo, pileMat);
      pile1.position.set(xPos, 0, -0.8);
      this.mesh.add(pile1);

      const pile2 = new THREE.Mesh(pileGeo, pileMat);
      pile2.position.set(xPos, 0, 0.8);
      this.mesh.add(pile2);
    }

    // Apply initial rotation to mesh to match physics
    // Physics angle is counter-clockwise radians.
    // ThreeJS rotation.y is counter-clockwise (if looking from top? No, usually Y-up, rotation around Y).
    // Entity.sync() does: this.mesh.rotation.y = -angle;
    // So we should set it similarly or just let sync() handle it if it was dynamic.
    // Since it's static, sync() might not be called every frame if we optimized it, 
    // but EntityManager calls sync() every frame for all entities.
    // So we don't strictly need to set it here, but good for init.
    this.mesh.rotation.y = -angle;
    this.mesh.position.set(x, 0, y);
  }

  update(dt: number) {
    // Static
  }
}

export class Buoy extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Group;
  private bobTimer: number = Math.random() * 100;

  constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
    super();

    // Physics: Dynamic but high damping to stay mostly in place
    // Spherical collision box
    this.physicsBody = physicsEngine.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      linearDamping: 1.0, // Reduced from 5.0 to allow pushing
      angularDamping: 2.0
    });

    this.physicsBody.createFixture({
      shape: planck.Circle(0.5), // 1m diameter
      density: 1.0,
      friction: 0.3,
      restitution: 0.5 // Bouncy
    });

    this.physicsBody.setUserData({ type: 'obstacle', subtype: 'buoy', entity: this });

    // Graphics
    this.mesh = new THREE.Group();

    // Buoy Base (Cylinder)
    // Red/White stripes
    const radius = 0.5;
    const height = 1.2;
    const segments = 16;

    const matRed = new THREE.MeshToonMaterial({ color: 0xFF0000 });
    const matWhite = new THREE.MeshToonMaterial({ color: 0xFFFFFF });

    // Bottom Red
    const bottomGeo = new THREE.CylinderGeometry(radius, radius * 0.8, height * 0.4, segments);
    const bottom = new THREE.Mesh(bottomGeo, matRed);
    bottom.position.y = -height * 0.2;
    this.mesh.add(bottom);

    // Middle White
    const midGeo = new THREE.CylinderGeometry(radius, radius, height * 0.3, segments);
    const mid = new THREE.Mesh(midGeo, matWhite);
    mid.position.y = height * 0.15;
    this.mesh.add(mid);

    // Top Red
    const topGeo = new THREE.CylinderGeometry(radius * 0.6, radius, height * 0.3, segments);
    const top = new THREE.Mesh(topGeo, matRed);
    top.position.y = height * 0.45;
    this.mesh.add(top);

    // Light/Sensor on top
    const lightGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const lightMat = new THREE.MeshToonMaterial({ color: 0xFFFF00, emissive: 0x444400 });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.y = height * 0.7;
    this.mesh.add(light);

    this.mesh.position.y = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  onHit() {
    // Buoys just bounce
  }

  update(dt: number) {
    if (!this.physicsBody) return;

    // Bobbing animation
    this.bobTimer += dt * 2.0;
    const bobOffset = Math.sin(this.bobTimer) * 0.1;

    // Apply bob to mesh Y (relative to physics body which is at 0)
    // Entity.sync() overwrites position, so we need to add offset to the mesh *child* or adjust sync?
    // Entity.sync() sets this.mesh.position.
    // If we want visual bobbing independent of physics, we should put the buoy parts in a child group and animate that.
    // Let's restructure mesh in constructor? 
    // Actually, Entity.sync() sets this.mesh.position.y = 0 (or whatever we set).
    // Wait, Entity.sync() usually sets x/z from physics and y from... where?
    // Let's check Entity.ts or just assume we can modify Y after sync?
    // If sync happens before update, we can override Y here.
    // If sync happens after, our change is overwritten.
    // Usually update is called, then physics step, then sync.
    // So we might need a child container.

    // Let's just iterate children and offset them? No, that accumulates.
    // Let's just assume we can set Y here and it sticks if sync doesn't touch Y.
    // Most Entity syncs only touch X/Z for 2D physics.
    // Let's verify Entity.ts later if needed. For now, let's try setting mesh.position.y.

    this.mesh.position.y = bobOffset;
  }
}

export class RiverRock extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Mesh;

  constructor(x: number, y: number, radius: number, physicsEngine: PhysicsEngine) {
    super();

    // Physics: Static
    this.physicsBody = physicsEngine.world.createBody({
      type: 'static',
      position: planck.Vec2(x, y),
      angle: Math.random() * Math.PI * 2
    });

    // Circle shape for physics
    this.physicsBody.createFixture({
      shape: planck.Circle(radius * 0.8),
      friction: 0.5,
      restitution: 0.2
    });

    this.physicsBody.setUserData({ type: 'obstacle', subtype: 'rock', entity: this });

    // Graphics: Vertical Rocky Outcrop
    // Cylinder base
    const height = radius * 3.0;
    const geometry = new THREE.CylinderGeometry(radius * 0.3, radius * 1.0, height, 8, 5);
    const posAttribute = geometry.attributes.position;
    const normalAttribute = geometry.attributes.normal;
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();

    // Deterministic Noise Function (Smoother)
    const noise = (x: number, y: number, z: number) => {
      return Math.sin(x * 1.0) * Math.cos(y * 0.8) * Math.sin(z * 1.0);
    };

    // Seed for this specific rock
    const seedX = Math.random() * 100;
    const seedY = Math.random() * 100;
    const seedZ = Math.random() * 100;

    for (let i = 0; i < posAttribute.count; i++) {
      vertex.fromBufferAttribute(posAttribute, i);
      normal.fromBufferAttribute(normalAttribute, i);

      // Apply Noise (Reduced amplitude)
      const n = noise(vertex.x + seedX, vertex.y + seedY, vertex.z + seedZ);
      const displacement = n * radius * 0.2;

      // Displace along normal
      vertex.add(normal.clone().multiplyScalar(displacement));

      // Extend bottom vertices deep down
      // Cylinder is centered at 0, so bottom is at -height/2
      if (vertex.y < -height * 0.45) {
        vertex.y -= 8.0; // Extend deep into river bed
        // Widen base further
        vertex.x *= 1.2;
        vertex.z *= 1.2;
      }

      posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshToonMaterial({
      color: 0x696969, // Dim Grey
    });
    // @ts-ignore
    material.flatShading = true;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Random rotation (Y-axis only to keep it vertical)
    this.mesh.rotation.y = Math.random() * Math.PI * 2;

    // Position: Move up so it sits nicely
    // Center of cylinder is at 0. Height is `height`.
    // We want top to be visible.
    // Water is at 0.
    // If we place mesh at y=0, center is at 0. Top is at height/2. Bottom is at -height/2 (minus extension).
    // This is perfect.
    // Lower it so only the top sticks out
    // Height is 3r. Top is at 1.5r.
    // We want top to be at ~0.5m above water.
    // So shift down by 1.5r - 0.5.
    this.mesh.position.y = -(height / 2) + 0.5 + (Math.random() * 0.5);
  }

  onHit() {
    // Solid
  }

  update(dt: number) {
    // Static
  }
}

export class Iceberg extends Entity {
  declare physicsBody: planck.Body;
  declare mesh: THREE.Group;

  constructor(x: number, y: number, radius: number, physicsEngine: PhysicsEngine) {
    super();

    // Physics: Dynamic but heavy (drifting ice)
    this.physicsBody = physicsEngine.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      linearDamping: 1.0, // Water resistance
      angularDamping: 1.0,
      angle: Math.random() * Math.PI * 2
    });

    // Polygon shape for physics (approximate with circle for now for stability, or box?)
    // Circle is best for drifting objects to avoid getting stuck.
    this.physicsBody.createFixture({
      shape: planck.Circle(radius * 0.8),
      density: 10.0, // Heavy ice (5x increase)
      friction: 0.1, // Slippery
      restitution: 0.2
    });

    this.physicsBody.setUserData({ type: 'obstacle', subtype: 'iceberg', entity: this });

    // Graphics: Floating Jagged Ice Sheet
    // Use ExtrudeGeometry for a flat top and jagged perimeter
    const shape = new THREE.Shape();
    const numPoints = 12;
    const angleStep = (Math.PI * 2) / numPoints;

    // Generate random jagged points
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep;
      // Vary radius: 0.7 to 1.3 of base radius
      const r = radius * (0.7 + Math.random() * 0.6);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r; // Shape is in XY plane initially

      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: 1.5, // Thickness of the ice sheet
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.1,
      bevelSegments: 1
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Center the geometry
    geometry.center();

    const material = new THREE.MeshToonMaterial({
      color: 0xE0F6FF, // Ice Blue
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    // @ts-ignore
    material.flatShading = true;

    this.mesh = new THREE.Group(); // Parent group handles Y-rotation (yaw) from physics
    const innerMesh = new THREE.Mesh(geometry, material);

    // Rotate inner mesh to lie flat on water
    innerMesh.rotation.x = -Math.PI / 2;

    // Position inner mesh
    innerMesh.position.y = 0.2;

    this.mesh.add(innerMesh);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  onHit() {
    // Solid
  }

  update(dt: number) {
    // Drifts naturally
  }
}
