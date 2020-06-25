import {
  Simulator,
  Metronome,
  Approach,
  AdaptiveFunction,
  Context,
  Request,
  PoissonDistribution,
  NormalDistribution,
  NormalCondition,
  Condition,
  GammaDistribution,
  ConstantDistribution,
  Ring,
  Response,
  CacheResponse
} from "queue-cache-distribution"
import "colors"



/*
Type            Count           QoS             AoI             Latency
Live            9748            1.00            0.00            95.45
Cached          192             1.00            3275.61         168.86
Fallbk          59              0.10            0.00            165.53
Total           9999            0.99            62.90           97.27


*/

class SmartApproach extends Approach {
  private latencyRing: Ring = new Ring(5);

  public async callDependency(req: Request) {
    let availability = a.ring.total() / a.ring.capacity();
    if (availability < 0)
      availability = 1;
    let latency = this.latencyRing.total() / this.latencyRing.capacity();
    if (latency < 0)
      latency = 0;
    // Can we factor in availability with c.utility(availability)
    const expectedWaitQoS = c.costOfDelay(latency) * c.utility(availability);


    this.getCache(req);
    if (req.cache.length > 0) {
      // determine if we should exit early
      const currentQoS = c.costOfDelay(0) * c.utility(req.cache[0].ageOfInformation);
      if (currentQoS > expectedWaitQoS) {
        return;
      }

    } else {
      // determine if we should fallback or wait for response
      const fallbackQoS = c.costOfDelay(0) * c.utility(a.retryPolicy.fallback);
      if (fallbackQoS > expectedWaitQoS) {
        this.getFallback(req);
        return;
      }
    }

    await this.getDependency(req);
    this.getFallback(req);
  }

  protected async getDependency(req: Request) {
    await super.getDependency(req);
    this.latencyRing.enq(this.metronome.now() - req.startTime)
  }
}

const adaption: AdaptiveFunction = {
  func: () => { },
  toString: () => "none"
}
const a: Approach = new SmartApproach(10000, { discipline: "FIFO", length: 8, servers: 4 }, { count: 1, fallback: 0.1, timeout: 180 }, adaption);
const c: Context = {
  arrivalRate: new PoissonDistribution(30),
  capacity: 30,
  costOfDelay: (latency) => sigmoid(latency, 190),
  dependencyCapacity: 30,
  keyspace: new NormalDistribution(1000, 50),
  numRequests: 10000,
  utility: (aoi: number) => sigmoid(aoi, 500, 4),
}

let degraded: Condition = {
  availability: new ConstantDistribution(0.995),
  successLatency: new GammaDistribution(6, 15),
  errorLatency: new GammaDistribution(6, 15),
}

let sim = new Simulator(new Metronome(), a, c, [NormalCondition, degraded]);
run();

async function run() {
  await sim.run();
  summary(sim);
}



type Metric = {
  count: number;
  qos: number;
  latency: number;
  aoi: number;
}
function sigmoid(value: number, max: number, k: number = 3) {
  if (value >= max) return 0;
  value /= max;
  return 1 / (1 + Math.pow(1 / value - 1, -k));
}

(latency: number) => {
  const k = 3;
  const max = 190; // somewhere around 98%
  if (latency > max) return 0;

  latency /= max;

  return 1 / (1 + Math.pow(1 / latency - 1, -k));
}


function summary(sim: Simulator) {
  sim.printSummary();

}
