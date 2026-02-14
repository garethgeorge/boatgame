export interface EntityBehavior {
    update(dt: number): void;
    updatePhysics(dt: number): void;
    updateVisuals(dt: number, alpha: number): void;
    updateSceneGraph(): void;
}
