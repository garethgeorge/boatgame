export interface EntityBehavior {
    update(dt: number): void;
    apply(dt: number): void;
    dispose?(): void;
}
