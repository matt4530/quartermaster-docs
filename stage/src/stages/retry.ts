import { WrappedStage } from "./wrapped-stage";
import { Event } from "../";


export class Retry extends WrappedStage {
  public count: number = 2;
  async workOn(event: Event): Promise<void> {
    let attempt: number = 0;
    while (attempt <= this.count) {
      try {
        await this.wrapped.accept(event);
        return;
      }
      catch {
        attempt++;
      }
    }
  }
}
