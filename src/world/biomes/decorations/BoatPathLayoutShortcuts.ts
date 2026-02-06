import { EntityGeneratorFn, EntityRules } from "./EntityLayoutRules";
import { Patterns, Placements, PlacementConfig } from "./BoatPathLayoutPatterns";
import { PatternConfig } from "./BoatPathLayoutStrategy";

export interface ShortcutOptions {
    minCount?: number;
    maxCount?: number;
}

/**
 * Shorthand functions for common BoatPathLayout patterns and placements.
 */
export class Place {
    // --- Sequence Patterns ---

    public static sequence_nearShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_onShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_slalom(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_path(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_scatter(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.scatter({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Scatter Patterns ---

    public static scatter_nearShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_onShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_slalom(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_path(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_middle(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_scatter(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.scatter({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Staggered Patterns ---

    public static staggered_nearShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_onShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_slalom(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_path(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_middle(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Gate Patterns ---

    public static gate_nearShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.gate({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static gate_slalom(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.gate({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static gate_path(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.gate({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Cluster Patterns ---

    public static cluster_nearShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_onShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_slalom(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_path(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_middle(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Sequence variations ---

    public static sequence_middle(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- At Shore Shortcuts ---

    public static sequence_atShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.atShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_atShore(entity: EntityGeneratorFn | EntityGeneratorFn[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.atShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Helpers ---

    private static _wrapEntity(entity: EntityGeneratorFn | EntityGeneratorFn[]): EntityGeneratorFn {
        if (Array.isArray(entity)) {
            return EntityRules.choose(entity);
        }
        return entity;
    }
}
