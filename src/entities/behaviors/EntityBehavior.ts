export interface EntityBehavior {
    update(dt: number): void;
    apply(dt: number): void;
    updateSceneGraph?(): void;
    dispose?(): void;
}
