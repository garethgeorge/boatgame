# Project GEMINI

## Overview
This is a 3D Boat Game built with **Three.js** for rendering and **Planck.js** (Box2D port) for 2D physics. The project follows a strict resource management strategy to prevent memory leaks in the WebGL context.

## Directory Structure
- **`src/core`**: Core engine subsystems including Graphics, Physics, and the Entity system.
- **`src/entities`**: Game entities (Boat, Obstacles, etc.).
- **`src/world`**: World generation, terrain chunks, biomes, and decoration placement.
- **`src/managers`**: High-level game managers (Input, Obstacles).
- **`src/shaders`**: Custom shader definitions.
- **`src/sky`**: Sky and day/night cycle management.

## Key Conventions & Nuanced APIs

### 1. Three.js Resource Tracking (CRITICAL)
The project implements a strict reference-counting system for Three.js resources (`Material`, `BufferGeometry`, `Texture`) to ensure proper disposal.

**File**: `src/core/GraphicsTracker.ts`

**Rules**:
- **NEVER** create a Mesh/Geometry/Material without tracking it.
- **NEVER** manually dispose a resource that might be shared. Use the tracker.

**API Usage**:
Use the helper methods in **`src/core/GraphicsUtils.ts`** instead of raw Three.js constructors where possible:

- **Creating Objects**:
  ```typescript
  // DO THIS:
  const mesh = GraphicsUtils.createMesh(geometry, material);
  
  // NOT THIS:
  const mesh = new THREE.Mesh(geometry, material); // Resource won't be tracked!
  ```

- **Replacing Resources**:
  If you need to swap a material or geometry on an existing mesh, you **MUST** use the safe assignment helpers. These methods handle decrementing the reference count of the old resource and incrementing the new one.
  ```typescript
  // DO THIS:
  GraphicsUtils.assignMaterial(mesh, newMaterial);
  GraphicsUtils.assignGeometry(mesh, newGeometry);
  
  // NOT THIS:
  mesh.material = newMaterial; // LEAK RISK: Old material not released, new one not tracked.
  ```

- **Loading/Cloning**:
  When loading models or cloning complex objects, register the root:
  ```typescript
  GraphicsUtils.registerObject(loadedModel);
  const clone = GraphicsUtils.cloneObject(original); // Recursively clones & tracks
  ```

- **Disposal**:
  When an entity is destroyed, ensure its meshes are untracked:
  ```typescript
  GraphicsUtils.disposeObject(mesh); // Recursively releases resources
  ```
  *Note: The base `Entity` class handles this for `this.meshes` automatically.*

### 2. Entity System & Physics Sync
**File**: `src/core/Entity.ts`

- **Physics-Graphics Separation**: Physics runs in 2D (Planck.js) on the X-Z plane (simulating top-down). Graphics run in 3D.
- **Syncing**: The `Entity.sync(alpha)` method handles interpolation between physics steps for smooth rendering.
  - It interpolates position and angle using `prevPos` and `prevAngle`.
  - It maps Physics Y -> Graphics Z.
- **Debug Meshes**: Entities can implement `ensureDebugMeshes()` to visualize physics bodies.

### 3. Toon Shading & Visuals
**File**: `src/core/GraphicsUtils.ts`

- **`toonify(model)`**: Converts standard materials to `MeshToonMaterial` using a shared gradient map for a cell-shaded look.
- **Gradient Map**: The gradient map is a shared resource managed by `GraphicsUtils`.

### 4. Game Loop
**File**: `src/Game.ts`

- **`animate()`**: The main loop.
- **`update(dt)`**: Fixed-step logic can be implemented here, though currently, it passes variable `dt`.
- **`Profiler`**: Use `Profiler.start('Label')` and `Profiler.end('Label')` to measure performance blocks.

## 5. Terrain & World Generation
**Files**: `src/world/TerrainManager.ts`, `src/world/TerrainChunk.ts`

The world is infinite and generated procedurally as the boat moves along the **Negative Z** axis.

-   **Chunks**: The world is divided into fixed-size chunks (`TerrainChunk`, 62.5 units long).
-   **TerrainManager**: Manages a sliding window of active chunks. It handles:
    -   **Async Generation**: Chunks are created asynchronously with `yieldToMain` to avoid frame drops.
    -   **Collision**: Generates static Box2D edge shapes for river banks around the player.
-   **TerrainChunk**: Generates three layers:
    -   **Ground**: `MeshToonMaterial` with vertex colors derived from biomes.
    -   **Water**: Custom `WaterShader`.
    -   **Decorations**: Instanced/merged meshes for performance.

## 6. Decoration System
**Files**: `src/world/Decorations.ts`, `src/world/factories/*`

Decorations (trees, rocks, etc.) use a **Registry + Factory** pattern to decouple placement logic from asset creation.

-   **`DecorationRegistry`**: Maps string keys (e.g., `'tree'`, `'rock'`) to simpler factories.
-   **`DecorationFactory`**: Interface for creating visual assets. Implementations (e.g., `TreeFactory`) handle procedural geometry generation or GLTF loading.
-   **`Decorations`**: Static facade providing strongly-typed accessors (e.g., `Decorations.getTree(...)`) that delegate to the registry.
-   **Optimization**: `TerrainChunk` uses `BiomeDecorationHelper` to batch and merge decoration geometries to reduce draw calls.

## 7. Entity & Spawner System
**Files**: `src/entities/obstacles/*`, `src/entities/spawners/*`

Dynamic game objects (Obstacles, Animals) follow a hierarchy designed for behavioral complexity.

### Architecture
-   **`Entity`** (Base): Manages `planck.Body` (Physics) and `THREE.Mesh` (Graphics) sync.
-   **`AttackAnimal`** (Abstract): Extends `Entity`. Implements:
    -   **State Machine**: Uses `EntityBehavior` classes (e.g., `ShoreIdle`, `EnteringWater`, `Swimming`) to drive logic.
    -   **Animation**: Uses `AnimationPlayer` to blend GLTF animations.
    -   **Physics**: Auto-configures dynamic bodies with specific density/friction.

### Spawning
**Files**: `src/entities/spawners/AttackAnimalSpawner.ts`
-   **Spawners**: Encapsulate placement rules (e.g., `AttackAnimalSpawner`).
-   **PlacementHelper**: Used to find valid positions (Shore vs. Water, clustering, distance from banks) without colliding with static terrain.

## 8. Documentation Maintenance
**Rule**: This file (`GEMINI.md`) serves as the architectural source of truth. When implementing new features or refactoring existing systems:
1.  **Check this file** to ensure your changes align with established patterns.
2.  **Update this file** if you introduce new patterns, subsystems, or change the architecture. Keep it living and accurate.

