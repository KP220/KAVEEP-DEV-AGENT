export class ToolRegistry {
  #tools = new Map();

  register(descriptor, handler) {
    if (!descriptor?.toolId || typeof handler !== "function") throw new Error("Tool descriptor and handler are required.");
    if (this.#tools.has(descriptor.toolId)) throw new Error(`Duplicate tool ID: ${descriptor.toolId}`);
    this.#tools.set(descriptor.toolId, Object.freeze({ descriptor: Object.freeze({ ...descriptor }), handler }));
  }

  resolve(toolId) {
    return this.#tools.get(toolId);
  }

  list() {
    return [...this.#tools.values()].map(({ descriptor }) => ({ ...descriptor })).sort((a, b) => a.toolId.localeCompare(b.toolId));
  }
}
