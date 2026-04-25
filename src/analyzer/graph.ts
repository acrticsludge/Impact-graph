type NodeId = string;

export class DependencyGraph {
  private adjacencyList: Map<NodeId, Set<NodeId>> = new Map();
  private reverseAdjacency: Map<NodeId, Set<NodeId>> = new Map();

  get nodeCount(): number {
    return this.adjacencyList.size;
  }

  addNode(node: NodeId): void {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, new Set());
      this.reverseAdjacency.set(node, new Set());
    }
  }

  addEdge(from: NodeId, to: NodeId): void {
    this.addNode(from);
    this.addNode(to);
    this.adjacencyList.get(from)!.add(to);
    this.reverseAdjacency.get(to)!.add(from);
  }

  getCallees(node: NodeId): NodeId[] {
    return Array.from(this.adjacencyList.get(node) || []);
  }

  getCallers(node: NodeId): NodeId[] {
    return Array.from(this.reverseAdjacency.get(node) || []);
  }

  getTransitiveCallees(node: NodeId, visited: Set<NodeId> = new Set()): NodeId[] {
    const result: NodeId[] = [];
    const callees = this.getCallees(node);

    for (const callee of callees) {
      if (!visited.has(callee)) {
        visited.add(callee);
        result.push(callee);
        result.push(...this.getTransitiveCallees(callee, visited));
      }
    }

    return result;
  }

  getTransitiveCallers(node: NodeId, visited: Set<NodeId> = new Set()): NodeId[] {
    const result: NodeId[] = [];
    const callers = this.getCallers(node);

    for (const caller of callers) {
      if (!visited.has(caller)) {
        visited.add(caller);
        result.push(caller);
        result.push(...this.getTransitiveCallers(caller, visited));
      }
    }

    return result;
  }

  getAllNodes(): NodeId[] {
    return Array.from(this.adjacencyList.keys());
  }
}
