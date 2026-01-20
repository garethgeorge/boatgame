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
Use the helper methods in **`src/core/GraphicsUtils.ts`** instead of raw Three.js constructors:

- **Creating Objects**:
  ```typescript
  // DO THIS:
  const mesh = GraphicsUtils.createMesh(geometry, material);
  
  // NOT THIS:
  const mesh = new THREE.Mesh(geometry, material); // Resource won't be tracked!
  ```
If an object is cached rather than being added to the scene graph be sure to mark it as cached. If this isn't done the leak checking system will assume it has been leaked. Cached geometry, materials, and textures don't need to be marked.
  ```typescript
  // DO THIS:
  GraphicsUtils.markAsCache(object);
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
  After loading a model register it so that its geometry, materials, and textures are
  properly tracked. To clone an existing object use the cloneObject() helper function
  to properly track the clone:
  ```typescript
  GraphicsUtils.registerObject(loadedModel);
  const clone = GraphicsUtils.cloneObject(original); // Recursively clones & tracks
  ```

- **Disposal**:
  To destroy an object that will not be used again call the disposeObject() function.
  This will dispose any referenced resources that are no longer needed:
  ```typescript
  GraphicsUtils.disposeObject(mesh); // Recursively releases resources
  ```
  *Note: The base `Entity` class handles this for `this.meshes` automatically.*

### 2. Coordinate Systems & Orientation
The game uses a specific mapping between the 2D physics engine (Planck.js) and the 3D rendering engine (Three.js).

| System | Longitudinal Axis | Lateral Axis | Vertical Axis |
| :--- | :--- | :--- | :--- |
| **Physics (Planck.js)** | Y | X | N/A |
| **Graphics (Three.js)** | Z | X | Y |

**Mapping Rules**:
- **Position**: `mesh.position.x = body.x` and `mesh.position.z = body.y`.
- **Forward Direction**: At `angle = 0`, an entity faces **Negative Y** in physics, which is **Negative Z** in world space (towards the top of the "river").
- **Rotation**: Graphics rotation is the negation of physics rotation: `mesh.rotation.y = -body.getAngle()`. This is handled automatically in `Entity.sync()`.
- **Model Alignment**: In `setupModel()`, models are typically rotated to face their internal "front" toward the Negative Z axis. For most animals, this requires a base rotation of `Math.PI`.

### 3. Entity System & Physics Sync
**File**: `src/core/Entity.ts`

- **Physics-Graphics Separation**: Physics runs in 2D (Planck.js) on the X-Z plane (simulating top-down). Graphics run in 3D.
- **Syncing**: The `Entity.sync(alpha)` method handles interpolation between physics steps for smooth rendering.
  - It interpolates position and angle using `prevPos` and `prevAngle`.
  - It maps Physics Y -> Graphics Z and applies `-angle` to `mesh.rotation.y`.
- **Debug Meshes**: Entities can implement `ensureDebugMeshes()` to visualize physics bodies.
- **Physics Bodies**: Every entity MUST have at least one physics body.
- **User Data**: Every physics body MUST have its user data set to include a reference to the entity: `physicsBody.setUserData({ ..., entity: this })`. This is required for physics-based entity removal.

### 4. Toon Shading & Visuals
**File**: `src/core/GraphicsUtils.ts`

- **`toonify(model)`**: Converts standard materials to `MeshToonMaterial` using a shared gradient map for a cell-shaded look.
- **Gradient Map**: The gradient map is a shared resource managed by `GraphicsUtils`.

### 5. Game Loop
**File**: `src/Game.ts`

- **`animate()`**: The main loop.
- **`update(dt)`**: Fixed-step logic can be implemented here, though currently, it passes variable `dt`.
- **`Profiler`**: Use `Profiler.start('Label')` and `Profiler.end('Label')` to measure performance blocks.

## 6. Terrain & World Generation
**Files**: `src/world/TerrainManager.ts`, `src/world/TerrainChunk.ts`

The world is infinite and generated procedurally as the boat moves along the **Negative Z** axis. Avoid using knowledge of the direction the boat is travelling except where it is necessary. In particular BiomeManager should be unaware of the direction whereas the BiomeFeatures instances that populate the biomes with decorations and obstacles may take direction into account.

-   **Chunks**: The world is divided into fixed-size chunks (`TerrainChunk`, 62.5 units long).
-   **TerrainManager**: Manages a sliding window of active chunks. It handles:
    -   **Async Generation**: Chunks are created asynchronously with `yieldToMain` to avoid frame drops.
    -   **Collision**: Generates static Box2D edge shapes for river banks around the player.
-   **TerrainChunk**: Generates three layers:
    -   **Ground**: `MeshToonMaterial` with vertex colors derived from biomes.
    -   **Water**: Custom `WaterShader`.
    -   **Decorations**: Instanced/merged meshes for performance.

## 7. Decoration System
**Files**: `src/world/Decorations.ts`, `src/world/factories/*`

Decorations (trees, rocks, etc.) use a **Registry + Factory** pattern to decouple placement logic from asset creation.

-   **`DecorationRegistry`**: Maps string keys (e.g., `'tree'`, `'rock'`) to simpler factories.
-   **`DecorationFactory`**: Interface for creating visual assets. Implementations (e.g., `TreeFactory`) handle procedural geometry generation or GLTF loading.
-   **`Decorations`**: Static facade providing strongly-typed accessors (e.g., `Decorations.getTree(...)`) that delegate to the registry.
-   **Optimization**: `TerrainChunk` uses `BiomeDecorationHelper` to batch and merge decoration geometries to reduce draw calls.

## 8. Entity & Spawner System
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

## 9. Animal Behavior & Logic System
**Files**: `src/entities/behaviors/AnimalUniversalBehavior.ts`, `src/entities/behaviors/logic/*`

The animal behavior system uses a three-tier architecture to separate high-level goals from movement execution.

### Tier 1: `AnimalUniversalBehavior` (Orchestrator)
The central component that interfaces with the `Entity` system. It manages:
- **Logic Script Execution**: Executes complex behavioral scripts using a logic stack. It calls the current logic's `update()` and `calculatePath()` methods.
- **Locomotion Execution**: Based on the `LocomotionType` (WATER, LAND, FLIGHT) returned by the logic, it applies physics forces (velocities, angular velocities, or kinematic positioning).
- **Script Advancement**: When a logic component returns `finish: true`, the orchestrator uses the provided `result` string to determine the next step in the script.
- **Event Dispatching**: Tracks changes in logic phase and dispatches events. The receiver can use this to update visuals such as animations.

### Tier 2: `AnimalLogic` (Goal Setting)
Defines *what* the animal wants to do. Each logic class (e.g., `WolfAttackLogic`, `ShoreWalkLogic`) implements the `AnimalLogic` interface.
- **Responsibility**: Manages its own internal state (e.g., timers, strategy switching) and delegates pathfinding to one or more `AnimalPathStrategy` instances.
- **Phase**: As the logic changes states it updates its current logic phase which can be queried.
- **Return Values**: Returns `finish: true` when it has completed its goal, along with a `result` string (e.g., `ShoreIdleLogic.RESULT_NOTICED`) to signal its outcome to the scripting engine.

### Tier 3: `AnimalPathStrategy` (Movement Execution)
Defines *how* the animal moves to achieve its goal.
- **Reference Implementation**: `AttackPathStrategies.ts` (e.g., `CircleFlankStrategy`, `SternInterceptStrategy`).
- **Responsibility**: Calculates a single `targetWorldPos` and `desiredSpeed` based on the target's position and velocity.
- **Abstraction**: Logic classes can swap strategies dynamically (e.g., switching from flanking to charging) without changing their overall goal.

### Key Concepts
- **Locomotion Types**:
    - **WATER**: Dynamic physics using `setLinearVelocity` and `setAngularVelocity`.
    - **LAND**: Kinematic physics for precise positioning on terrain (includes height/normal alignment).
    - **FLIGHT**: Kinematic physics with banking and height control.
- **Scripted Behaviors**: Complex behaviors are defined using the `AnimalLogicStep` helpers:
    - `sequence([...])`: Plays a list of scripts in order.
    - `until(result, script)`: Loops a script until a specific result string is returned.
    - `random([...])`: Picks a random script from a list.
- **Logic Registry**: `AnimalLogicRegistry` is used to instantiate logic from configuration objects, enabling extensible behavior definitions in spawners.

## 10. Animation Scripting System
**Files**: `src/core/AnimationPlayer.ts`

The `AnimationPlayer` uses a similar stack-based scripting engine to manage complex animation sequences (e.g., a "jump" into water followed by a "swim" loop).

### 1. Script Components
- **`AnimationParameters`**: A static configuration specifying the animation name, `startTime`, `timeScale`, `duration`, and `repeat` count.
- **`AnimationScript`**: A functional type `(step: number) => AnimationScript | null` that allows for procedural sequences.

### 2. Scripting Helpers (`AnimationStep`)
- **`sequence([...])`**: Executes a list of animation scripts in order.
- **`random(repeat, weights, choices)`**: Randomly selects from a list of choices for a specified number of repetitions.

### 3. Execution Model
1. **Triggering**: A script is started via `player.play(script)`.
2. **Stack Management**: Procedural scripts are pushed onto a stack. The player resolves the stack until a static `AnimationParameters` is found.
3. **Event-Driven Advancement**: When an animation completes (or finishes its specified `repeat` count), the `THREE.AnimationMixer`'s `'finished'` event triggers the player to resolve the next step in the script.

## 11. Declarative Biome Layout System
**Files**: `src/world/biomes/BoatPathLayoutStrategy.ts`, `src/world/biomes/*BiomeFeatures.ts`

The layout system uses a declarative approach to define the "intended path" for the boat and the distribution of obstacles and rewards.

### 1. Conceptual Design
The system generates a **BoatPathLayout** which consists of:
- **Directed Weaving Path**: A sinusoidal path that weaves between river banks, providing a guided but challenging route.
- **Independent Tracks**: Multiple parallel tracks (e.g., 'main', 'rewards', 'unique_elements') that contribute obstacle placements independently, allowing for layered behavioral complexity.

### 2. Pattern System
Obstacles are placed according to high-level patterns defined in `PatternConfig`.
- **Pattern Logics**:
    - `scatter`: Randomized placement within a segment.
    - `sequence`: Evenly spaced placements.
    - `gate`: Placements on opposite sides of the boat path to create a narrowing.
    - `staggered`: Alternating sides relative to the boat path.
    - `cluster`: Dense grouping around a central point.
- **Placement Types**:
    - `path`: Directly on the boat's intended path.
    - `slalom`: Off-path, forcing the player to weave.
    - `shore`: Placed on or near the banks (refined by `waterAnimals` list).

### 3. Track & Stage Architecture
A biome's layout is composed of one or more **Tracks**. Each track consists of a sequence of **Stages**.
- **Stages**: Defined for specific progress ranges (0.0 to 1.0). The system randomly selects and scales stages to fill the biome.
- **Weighted Selection**: Each stage picks patterns from weighted arrays, ensuring variety in procedural generation.
- **Explicit Placements**: Tracks can also contain `ExplicitPlacementConfig` for unique, non-procedural elements (e.g., a finish line or a boss encounter) at fixed progress points.

### 4. Implementation Details
The `BoatPathLayoutStrategy.createLayout()` follows a deterministic multi-step process:
1. **Geometry Sampling**: Samples `RiverGeometry` to establish an arc-length coordinate system.
2. **Track Generation**: Independently chooses and scales stages for every track.
3. **Weaving Calculation**: Calculates "crossings" based on the primary track's stage boundaries to determine when the boat should weave.
4. **Placement Resolution**: Resolves pattern logic into concrete `ObstaclePlacement` objects with defined `range` (lateral boundaries) and `aggressiveness`).

### 5. Extension Guide
- **Adding Pattern Logics**: Implement the logic in `populatePlacements()` to calculate `pathIndex` and pass hints to `applyIndividualPlacement()`.
- **Adding Placement Types**: Update `placementRange()` to define how the lateral `[min, max]` range is calculated relative to the boat path and river banks.

## 12. Procedural Decoration Placement System
**Files**: `src/world/decorators/PoissonDecorationStrategy.ts`, `src/world/decorators/PoissonDecorationRules.ts`, `src/world/decorators/TerrainDecorator.ts`

This system uses **Poisson Disk Sampling** with variable radii to place static decorations (trees, rocks, flowers) across the terrain. Position fitness and object spacing are controlled by declarative rules and environmental signals.

### 1. Core Architecture
-   **`PoissonDecorationStrategy`**: The engine implementing Bridson's algorithm. It uses a fitness value (0-1) to determine both the probability of placement and the required spacing (thinning placement in low-fitness areas).
-   **`TerrainDecorator`**: A high-level facade that connects the strategy to the `RiverSystem` (for terrain data) and the `Decorations` registry (for asset creation).
-   **`WorldContext`**: A data object passed to rules containing local environmental data: elevation, slope (degrees), distance to river, and biome progress.

### 2. Client Usage (Constructing a Biome)
To populate a biome, define a set of `DecorationRule`s and call `TerrainDecorator.decorate`.

**Example (Simplified `HappyBiomeFeatures.ts`)**:
```typescript
private decorationRules: DecorationRule[] = [
    new TierRule({
        species: [
            {
                id: 'oak_tree',
                preference: Combine.all(
                    Signal.constant(1.0),
                    Signal.linearRange(Signal.distanceToRiver, 5, 50), // Prefer away from river
                    Signal.inRange(Signal.slope, 0, 30) // Only on flat/low slope
                ),
                params: (ctx) => {
                    const scale = 0.8 + ctx.random() * 0.4;
                    return {
                        radius: SpeciesHelpers.attenuate(ctx, 12 * scale),
                        options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                    };
                }
            }
        ]
    })
];

async decorate(context: DecorationContext, zStart: number, zEnd: number) {
    TerrainDecorator.decorate(context, this.decorationRules, region, 20);
}
```

**Key Concepts for Clients**:
-   **Signals**: Functional helpers to extract or transform environmental data (e.g., `Signal.elevation`, `Signal.inRange`). Slope is measured in degrees.
-   **Composition**: Use `Combine.all` (AND logic/multiplication) or `Combine.any` (OR logic/max) to build complex fitness functions.
-   **Tiers**: `TierRule` groups species and selects a single winner from its members based on the highest local preference.
-   **Variable Radius**: The `radius` returned by `params` is the "spacing requirement". High fitness results in dense placement (at `radius`), while low fitness increases spacing (up to 4x).

### 3. Extension & Internals
-   **Spatial Grid**: `SpatialGrid` handles collision detection. Similarly to the L-System, it uses a grid but dynamically tracks the maximum radius of any placed object to calculate the necessary search neighborhood. This ensures large spacing requirements are respected without a massive grid cell size.
-   **Fitness-Based Thinning**: `getVariableRadius` inverts the fitness value using a power curve. If `fitness` is 1.0, spacing is exactly `radius`. As `fitness` approaches 0, spacing increases significantly.
-   **Growth Phase**: Candidates are generated in an annulus around parent samples. The search distance is randomly selected between `2*r` and `4*r` where `r` is the variable radius, ensuring a high-quality distribution.

## 13. Documentation Maintenance
**Rule**: This file (`GEMINI.md`) serves as the architectural source of truth. When implementing new features or refactoring existing systems:
1.  **Check this file** to ensure your changes align with established patterns.
2.  **Update this file** if you introduce new patterns, subsystems, or change the architecture. Keep it living and accurate.

## 14. Code Style and Standards
**Rule**
- Avoid casting to any in typescript except where there is no reasonable alternative or it is being done for performance reasons.
- Don't remove comments in the code unless they are no longer applicable.

## 15. Procedural Tree System (L-Systems)
**Files**: `src/world/factories/LSystemTreeGenerator.ts`, `src/world/factories/LSystemTreeArchetypes.ts`

The vegetation system uses a Lindenmayer System (L-System) to generate procedural tree geometries. This allows for defining complex, organic tree structures using simple string-based production rules and parameters.

### 1. Generation Pipeline (`LSystemTreeGenerator.ts`)
The generator follows a 4-pass process to create a complete tree mesh:

1.  **Topology Pass (Turtle Graphics)**:
    -   Interprets the L-System string (axiom + iterations).
    -   Uses "Turtle" logic to build a topological graph of `TreeNode`s.
    -   Handles state management `[` `]`, rotation `&` `/`, and leaf placement `+` `$`.
    -   Processes terminal symbols defined in the `branches` registry to create branch segments.
    -   Applies physical modifiers like `gravity`, `wind`, and `heliotropism` based on the active branch parameters.
2.  **Radii Pass (Pipe Model)**:
    -   Calculates branch thickness using the "Pipe Model" theory.
    -   Back-propagates "leaf load" from tips to root.
    -   `radius = thickness * (leafCount ^ thicknessDecay)`.
3.  **Vigor Pass (Length Adjustment)**:
    -   Adjusts branch lengths based on "vigor" (ratio of child load to parent load).
    -   Vigorous branches (more leaves) grow longer; weak branches receive less resources and stay shorter.
4.  **Geometry Pass**:
    -   Converts the adjusted node graph into `CylinderGeometry` for branches and instanced meshes for leaves.

### 2. Defining Trees (`LSystemTreeArchetypes.ts`)
Trees are defined by `TreeConfig` objects in the `ARCHETYPES` registry.

#### A. Grammar & Rules
-   **Axiom**: The starting string (e.g., `"X"`).
-   **Rules**: String replacements applied each iteration.
    -   **Simple**: `'A': { successor: "AB" }`
    -   **Stochastic**: `'A': { successors: ["A", "B"], weights: [0.8, 0.2] }`
    -   **Parametric**: `'A': (i) => { return ... }` (Rules can change based on iteration count).
-   **Branches**: A dictionary mapping terminal symbols to `BranchParams`.
    -   **Example**: `'=': { gravity: 0.1 }`
-   **FinalRule**: All non-terminal symbols are replaced with this in the final iteration.

#### B. Symbols
-   **Terminal Symbols (Branching)**: Any symbol present in the `branches` record (e.g., `=`, `#`, `-`) will trigger the creation of a branch segment and move the turtle forward. These can be defined with custom `BranchParams`. A pseudo-branch can be created by setting its scale to 0. No branch is created but parameters can then be defined for the & etc operators that attach things to the branch.
-   **Built-in Graphics Symbols**:
    -   `[` : **Push State**. Start a new branch junction.
    -   `]` : **Pop State**. End current branch and return to parent junction.
    -   `&` : **Pitch**. Rotate around the local X axis (controlled by `spread`).
    -   `/` : **Yaw**. Rotate around the local Y axis (golden angle).
    -   `+` : **Standard Leaf**. Marks a node as having a leaf oriented along the branch.
    -   `^` : **Orient Upright (with jitter)**. Resets the turtle to point upwards (0,1,0), perturbed by the current branch's jitter.
-   **Non-terminal symbols**: Any other symbol (typically `A-Z`) used for expansion logic.

#### C. Branch Parameters
Each symbol in the `branches` registry is associated with `BranchParams` that define its physical behavior:
-   **Geometric**:
    -   `scale`: Multiplier for the branch length.
    -   `spread`: Local branching angle (degrees).
    -   `jitter`: Random variation in branching angles.
-   **Physical Forces**:
    -   `gravity`: Pulls branches down (+ve) or up (-ve).
    -   `wind`, `windForce`: Directional force affecting branch orientation.
    -   `heliotropism`: Bias towards the vertical (up).
    -   `horizonBias`: Bias towards the horizontal plane.
    -   `antiShadow`: Push growth away from the center of the tree.

### 3. Leaf Generation
Leaves are generated separately using strategies defined in `LeafKind`.
-   **Types**: `blob`, `willow`, `irregular`, `cluster`, `umbrella`.
-   **Configuration**: Color, size, thickness, and count per attachment point.

## 16. Verification

Use `npx tsc --noEmit` to verify that the code passes typescript checks.