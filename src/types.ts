export type ItemIcon = {
  png?: string;
  png128?: string;
  realesrganX4?: string;
  missing?: boolean;
};

export type Equipment = {
  id: string;
  name: string;
  kind: string;
  level: string;
  class?: string;
  randomPool?: boolean;
  hp?: string;
  description: string;
  stats: string[];
  effects: string[];
  icon?: ItemIcon | null;
  raw?: {
    tip?: string;
    itemClass?: string;
    pickRandom?: string;
  };
  refining?: {
    hp: number;
    slot: string;
    attribute: string;
    name: string;
    label: string;
    itemLevel: number | null;
    displayLevel: string;
  };
};

export type Recipe = {
  id: string;
  type: string;
  scroll: { id: string; name: string };
  result: { id: string; name: string };
  level: string;
  materials: Array<{ id?: string; name: string; quantity: number }>;
  description: string;
};

export type Output = {
  kind: "fixed" | "random-pool";
  id?: string;
  name?: string;
  levelExpression?: string;
  itemType?: string;
  expression: string;
};

export type RefiningRule = {
  id: string;
  type: "dynamic-refining" | "exact-refining";
  functionName: string;
  sourceLines: { start: number; end: number };
  mainHpValues?: number[];
  materialHpValues?: number[];
  readable?: {
    main: RefiningGroup;
    material: RefiningGroup;
    levelRequirement: string;
    blockedItems: string[];
  };
  requiredItems?: Array<{ id: string; name: string; expression: string; quantity?: number }>;
  requiredItemGroups?: Array<{
    mode: "one-of";
    label: string;
    items: Array<{ id: string; name: string; expression: string; quantity?: number }>;
  }>;
  condition?: string;
  possibleOutputs: Output[];
  probabilityBranches?: Array<{
    sourceLine: number;
    context?: {
      levelDifference?: { code: string; label: string } | null;
      mainItemLevel?: { value: number; label: string } | null;
    };
    random: { variable: string; min: number; max: number };
    outcomes: Array<{
      condition: string;
      weight: number;
      totalWeight: number;
      chance: number;
      chancePercent: number;
      outputs: Output[];
    }>;
  }>;
};

export type RefiningGroup = {
  label: string;
  hpValues: number[];
  slots: string[];
  attributes: string[];
  names: string[];
  bySlot: Record<string, string[]>;
  byAttribute: Record<string, string[]>;
  unknownHpValues: number[];
};

export type SourceEntry = {
  kind: "recipe" | "exact" | "dynamic";
  title: string;
  summary: string;
  detail: string[];
  probability?: string;
  rule?: RefiningRule;
};
