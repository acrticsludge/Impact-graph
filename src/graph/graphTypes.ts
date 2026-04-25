export type ImpactGraphNodeType = 'function' | 'file' | 'module';
export type ImpactGraphNodeRisk = 'low' | 'moderate' | 'high';
export type ImpactGraphEdgeType = 'calls' | 'imports';

export interface ImpactGraphNode {
  id: string;
  label: string;
  type: ImpactGraphNodeType;
  layer: string;
  risk: ImpactGraphNodeRisk;
}

export interface ImpactGraphEdge {
  from: string;
  to: string;
  type: ImpactGraphEdgeType;
}

export interface ImpactGraph {
  nodes: ImpactGraphNode[];
  edges: ImpactGraphEdge[];
}
