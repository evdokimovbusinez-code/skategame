export interface Objective {
  id: string;
  description: string;
}

export interface QuestDef {
  id: string;
  title: string;
  objectives: Objective[];
}
