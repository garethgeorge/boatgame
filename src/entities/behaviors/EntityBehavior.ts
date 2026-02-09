
export interface EntityBehavior {
    update(dt: number): void;
    dispose?(): void;
}
