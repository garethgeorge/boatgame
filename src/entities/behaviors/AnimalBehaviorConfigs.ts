export type AttackBehaviorConfig =
    | { type: 'none' }
    | { type: 'attack'; logicName: 'AmbushAttack' | 'WolfAttack' }
    | { type: 'wait-attack'; logicName: 'AmbushAttack' | 'WolfAttack' }
    | { type: 'walk-attack'; logicName: 'AmbushAttack' | 'WolfAttack' };

export type SwimAwayBehaviorConfig =
    { type: 'none' }
    | { type: 'swim' }
    | { type: 'wait-swim' };

export type ShoreBehaviorConfig =
    { type: 'none' };

export type AnimalBehaviorConfig =
    AttackBehaviorConfig
    | ShoreBehaviorConfig
    | SwimAwayBehaviorConfig;
