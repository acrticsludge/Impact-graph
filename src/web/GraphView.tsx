'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from 'd3-force';
import { ImpactGraph, ImpactGraphNode } from '../graph/graphTypes.js';

interface GraphViewProps {
  graph: ImpactGraph;
  target: string;
  width?: number;
  height?: number;
}

type PositionedNode = ImpactGraphNode & SimulationNodeDatum;

interface PositionedLink extends SimulationLinkDatum<PositionedNode> {
  source: string | PositionedNode;
  target: string | PositionedNode;
  type: string;
}

const NODE_COLORS: Record<ImpactGraphNode['risk'], string> = {
  high: '#ef4444',
  moderate: '#facc15',
  low: '#22c55e',
};

export function GraphView({ graph, target, width = 900, height = 600 }: GraphViewProps) {
  const [selectedId, setSelectedId] = useState<string>(target);
  const [nodes, setNodes] = useState<PositionedNode[]>(() => seedNodes(graph.nodes, target, width, height));
  const links = useMemo<PositionedLink[]>(
    () => graph.edges.map(edge => ({ source: edge.from, target: edge.to, type: edge.type })),
    [graph.edges]
  );

  useEffect(() => {
    const seededNodes = seedNodes(graph.nodes, target, width, height);
    const seededLinks: PositionedLink[] = graph.edges.map(edge => ({ source: edge.from, target: edge.to, type: edge.type }));

    const simulation = forceSimulation<PositionedNode>(seededNodes)
      .force('link', forceLink<PositionedNode, PositionedLink>(seededLinks).id(node => node.id).distance(110))
      .force('charge', forceManyBody().strength(-360))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide(34))
      .on('tick', () => setNodes([...seededNodes]));

    return () => {
      simulation.stop();
    };
  }, [graph, height, target, width]);

  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);

  return (
    <svg role="img" aria-label={`Impact graph for ${target}`} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
      {links.map(link => {
        const source = resolveLinkNode(link.source, nodeById);
        const targetNode = resolveLinkNode(link.target, nodeById);
        if (!source || !targetNode) return null;

        return (
          <line
            key={`${source.id}->${targetNode.id}:${link.type}`}
            x1={source.x ?? 0}
            y1={source.y ?? 0}
            x2={targetNode.x ?? 0}
            y2={targetNode.y ?? 0}
            stroke={link.type === 'imports' ? '#94a3b8' : '#64748b'}
            strokeWidth={selectedId === source.id || selectedId === targetNode.id ? 2.6 : 1.4}
            strokeDasharray={link.type === 'imports' ? '5 5' : undefined}
          />
        );
      })}
      {nodes.map(node => {
        const isTarget = node.id === target;
        const isSelected = node.id === selectedId;

        return (
          <g key={node.id} transform={`translate(${node.x ?? width / 2}, ${node.y ?? height / 2})`}>
            <circle
              r={isTarget ? 15 : 11}
              fill={NODE_COLORS[node.risk]}
              stroke={isTarget || isSelected ? '#111827' : '#ffffff'}
              strokeWidth={isTarget || isSelected ? 4 : 2}
              onClick={() => setSelectedId(node.id)}
            />
            <text x={16} y={4} fontSize={12} fill="#111827" fontFamily="Inter, system-ui, sans-serif">
              {node.label}
            </text>
            <title>{`${node.id}\nLayer: ${node.layer}\nRisk: ${node.risk}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

export default GraphView;

function seedNodes(nodes: ImpactGraphNode[], target: string, width: number, height: number): PositionedNode[] {
  const radius = Math.max(120, Math.min(width, height) / 3);
  const outerNodes = nodes.filter(node => node.id !== target);

  return nodes.map(node => {
    if (node.id === target) {
      return { ...node, x: width / 2, y: height / 2, fx: width / 2, fy: height / 2 };
    }

    const index = outerNodes.findIndex(item => item.id === node.id);
    const angle = (index / Math.max(1, outerNodes.length)) * Math.PI * 2;
    return {
      ...node,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
    };
  });
}

function resolveLinkNode(value: string | number | PositionedNode, nodeById: Map<string, PositionedNode>): PositionedNode | null {
  if (typeof value === 'object') return value;
  return nodeById.get(String(value)) ?? null;
}
