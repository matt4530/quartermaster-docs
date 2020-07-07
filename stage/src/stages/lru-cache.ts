import { Cache } from "./cache";
import { metronome } from "../metronome";

/**
 * A fixed capacity cache that evicts the least recently used
 * elements first. Also includes a TTL.
 */


export class LRUCache extends Cache {
  public ttl: number = 10000;
  public capacity: number = 1000;
  protected order: string[] = [];


  get(key: string): any {
    let line = this._cache[key];
    if (line && metronome.now() - line.time > this.ttl) {
      const keyIndexToRemove = this.order.findIndex(x => x === key);
      this.order.splice(keyIndexToRemove, 1);
      delete this._cache[key];
      return undefined;
    }
    return line;
  }

  public set(key: string, value: any): void {
    this.order = this.order.filter(x => x != key);
    this.order.push(key);
    super.set(key, value);
    this.evict();
  }

  public evict(): void {
    if (this.order.length > this.capacity) {
      const keyToRemove = this.order.shift() as string;
      delete this._cache[keyToRemove];
    }
  }
}
