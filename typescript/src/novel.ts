import {
  Simulator,
  Metronome,
  Approach,
  CacheDiscipline,
  AdaptiveFunction,
  Context,
  PoissonDistribution,
  NormalDistribution,
  NormalCondition,
  Condition,
  GammaDistribution,
  ConstantDistribution
} from "queue-cache-distribution"



const m = new Metronome();

const adaption: AdaptiveFunction = {
  func: () => { },
  toString: () => "none"
}
const a: Approach = new Approach(CacheDiscipline.TTL, { discipline: "FIFO", length: 8, servers: 4 }, { count: 1, fallback: 0.1, timeout: 180 }, adaption);
const c: Context = {
  arrivalRate: new PoissonDistribution(30),
  capacity: 30,
  costOfDelay: (aoi: number) => 1,
  dependencyCapacity: 30,
  keyspace: new NormalDistribution(1000, 50),
  numRequests: 10000,
  utility: (latency: number) => 1,
}

let degraded: Condition = {
  availability: new ConstantDistribution(0.995),
  successLatency: new GammaDistribution(6, 15),
  errorLatency: new GammaDistribution(6, 15),
}

let sim = new Simulator(m, a, c, [NormalCondition, degraded]);
run();

async function run() {
  await sim.run();
  const data = sim.getAll();
  console.log(data);
}