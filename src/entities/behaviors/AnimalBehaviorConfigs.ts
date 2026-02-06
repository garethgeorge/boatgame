export type AttackBehaviorConfig =
    | { type: 'none' }
    // starts out in river and executes attack logic
    | { type: 'attack'; logicName: 'AmbushAttack' | 'WolfAttack' }
    // starts out waiting on land, enters river, and executes attack
    | { type: 'wait-attack'; logicName: 'AmbushAttack' | 'WolfAttack' }
    // starts out waiting/walking on land, enters river, and executes attack
    | { type: 'walk-attack'; logicName: 'AmbushAttack' | 'WolfAttack' };

export type SwimAwayBehaviorConfig =
    { type: 'none' }
    // starts out in river and swims away when boat is near
    | { type: 'swim' }
    // starts out on land, enters river, swims away when boat is near
    | { type: 'wait-swim' }
    // starts out on land, walks around, enters river, swims away when boat is near
    | { type: 'walk-swim' };

export type ShoreBehaviorConfig =
    { type: 'none' }
    | { type: 'unicorn' };

export type AnimalBehaviorConfig =
    AttackBehaviorConfig
    | ShoreBehaviorConfig
    | SwimAwayBehaviorConfig;
