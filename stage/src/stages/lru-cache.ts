import { Cache } from "./cache";

/**
 * A fixed capacity cache that evicts the least recently used
 * elements first.
 */


export class LRUCache extends Cache {
  public capacity: number = 1000;
  protected order: string[] = [];


  public set(key: string, value: any): void {
    this.order = this.order.filter(x => x != key);
    this.order.push(key);
    if (this.order.length > this.capacity) {
      const keyToRemove = this.order.shift() as string;
      delete this._cache[keyToRemove];
    }
  }
}
