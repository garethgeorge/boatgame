import { Patterns, Placements } from "./BoatPathLayoutPatterns";
import { PatternConfig } from "./BoatPathLayoutStrategy";
import { LayoutRule } from "./LayoutRule";
import { LayoutRules } from "./LayoutRuleBuilders";

export interface ShortcutOptions {
    minCount?: number;
    maxCount?: number;
}

/**
 * Shorthand functions for common BoatPathLayout patterns and placements.
 */
export class Place {
    // --- Sequence Patterns ---

    public static sequence_nearShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_onShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_slalom(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_path(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static sequence_scatter(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.scatter({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Scatter Patterns ---

    public static scatter_nearShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_onShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_slalom(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_path(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_middle(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_scatter(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.scatter({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Staggered Patterns ---

    public static staggered_nearShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_onShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_slalom(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_path(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static staggered_middle(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.staggered({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Gate Patterns ---

    public static gate_nearShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.gate({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static gate_slalom(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.gate({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static gate_path(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.gate({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Cluster Patterns ---

    public static cluster_nearShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.nearShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_onShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.onShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_slalom(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.slalom({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_path(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.path({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static cluster_middle(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.cluster({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Sequence variations ---

    public static sequence_middle(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.middle({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- At Shore Shortcuts ---

    public static sequence_atShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.sequence({
            placement: Placements.atShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    public static scatter_atShore(entity: LayoutRule | LayoutRule[], density?: [number, number], options?: ShortcutOptions): PatternConfig {
        return Patterns.scatter({
            placement: Placements.atShore({ entity: this._wrapEntity(entity) }),
            density,
            ...options
        });
    }

    // --- Helpers ---

    private static _wrapEntity(entity: LayoutRule | LayoutRule[]): LayoutRule {
        if (Array.isArray(entity)) {
            return LayoutRules.choose(entity);
        }
        return entity;
    }
}
