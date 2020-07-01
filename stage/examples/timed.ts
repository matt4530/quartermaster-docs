

import { TimedDependency, Cache, run, summary } from "../src";

const live = new TimedDependency();
live.mean = 150;
live.std = 20;

const cache = new Cache(live);


work();
async function work() {
  await run(cache, 100, 20000);
  summary([cache, live])
}


