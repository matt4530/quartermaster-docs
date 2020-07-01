import { Stage } from "./stage";

/**
 * Wrapped Stage encapsulates a single other stage. Useful for 
 * retries, caches, timeouts, etc.
 */
export abstract class WrappedStage extends Stage {
  constructor(protected wrapped: Stage) {
    super();
  }
}