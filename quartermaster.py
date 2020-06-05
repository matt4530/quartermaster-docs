#
# Stats utilities
#
import math
from random import random


def coin_toss(weight=0.5):
    return random() < weight


def std_normal():
    u = v = 0
    while u == 0:
        u = random()
    while v == 0:
        v = random()

    return math.sqrt(-2.0 * math.log(u)) * math.cos(2.0 * math.pi * v)


def exponential(max=1, slope=25):
    # Sample from an exponential distribution with given maximum value and slope
    return max * math.log(1-(1-math.e**slope)*random())/slope


def normal(mean, std):
    return std_normal() * std + mean


def sigmoid(x, max_x, k=4):
    # Compute the value of x using a sigmoid function with a given max and k value. k == 1 makes this a nearly linear decay function, and as k increases it gets closer to a step function. With 2.5<k<7.5 we get a pretty smooth looking s curve. k>10 gets pretty much like a step function (but not quite, of course). For 0<k<1 the curve drops more quickly and then stays around 0.5 longer.

    if x >= max_x:
        return 0
    elif x == 0:
        return 1.0
    else:
        x = x/max_x  # normalize x to [0,1]
        return 1.0/(1+(1.0/x - 1)**(-k))

#
# Data structures
#


class Request:
    def __init__(self, key):
        self.key = key
        self.start_ts = clock.ts
        self.end_ts = None
        self.tries = 0
        self.responded = False
        self.queue_t = {'q1': 0, 'q2': 0}  # queue position
        self.queue_p = {'q1': -1, 'q2': -1}
        self.dependency_t = 0

    def latency(self):
        return self.end_ts - self.start_ts

    def __str__(self):
        return "%d: tries=%d, responded=%s" % (self.key, self.tries, self.responded)


class Queue:
    def __init__(self, name='Q'):
        self.items = []
        self.name = name

    def remove(self, r):
        self.items.remove(r)

        r.queue_p[self.name] = -1
        self._update_positions()

    def enqueue(self, r):
        r.enqueue_ts = clock.ts
        self.items.append(r)

        self._update_positions()

    def dequeue(self):
        r = self.items.pop(0)
        if r:
            r.queue_t[self.name] += clock.ts - r.enqueue_ts
            r.queue_p[self.name] = -1
            self._update_positions()
        return r

    def full(self, max):
        return len(self.items) >= max

    def empty(self):
        return len(self.items) == 0

    def _update_positions(self):
        for i, r in enumerate(self.items):
            r.queue_p[self.name] = i


class Cache:
    def __init__(self):
        self.entries = {}

    def read(self, key):
        if key in self.entries:
            return self.entries[key]

    def write(self, key):
        self.entries[key] = clock.ts
        evict()


def cache_hit(r):
    if hasattr(r, 'cache_ts') and r.cache_ts:
        return cache_age(r) < Server.ttl


def cache_age(r):
    if r.responded:
        return r.end_ts - r.cache_ts

    return clock.ts - r.cache_ts


def evict():
    pass


class Clock:
    def __init__(self):
        self.ts = 0

    def tick(self):
        self.ts += 1

#
# Pools and workers
#


class P1Worker:
    def __init__(self, r):
        self.r = r
        self.r.cache_ts = cache.read(r.key)
        enqueue_or_respond(q2, self.r)

    def is_done(self):
        return self.r.responded


class P2Worker:
    def __init__(self, r):
        self.r = r
        t, self.result = dependency()
        self.r.dependency_t += t
        self.done_at_ts = clock.ts + t

    def is_done(self):
        return clock.ts >= self.done_at_ts


def complete(workers):
    return [w for w in workers if w.is_done()]


def not_complete(workers):
    return [w for w in workers if not w.is_done()]

#
# Configuration
#


class Client:
    rate = 25  # ticks/request  # 33 reqs/sec
    key_space = 50000          # normal(1000,50)
    decay_k = 3
    decay_max = 400
    cache_age_k = 3
    cache_age_max = 600000
    live = 1.0
    fallback = 0.1
    rejected = 0.01


class Server:
    p1_max = 10  # 30
    p2_max = 5   # 4
    q1_max = 10
    q2_max = 10  # 12
    ttl = 300000  # 10000
    tries = 1    # 0


class Dependency:
    mean = error_mean = 150
    std = error_std = 25
    availability = 0.98
    timeout = 175

#
# Overridable functions
#


def configure():
    pass


def abandon(r):
    # if r.tries >= 1 and cache_hit(r):
    #   return 'reneg'

    if cache_hit(r) or r.tries >= Server.tries:
        return "reneg"

    return 'wait'


def response(r):
    return "cached" if cache_hit(r) else "fallback"


def qos(r):
    if r.response_type == 'rejected':
        value = Client.rejected
    elif r.response_type == 'live':
        value = Client.live
    elif r.response_type == 'fallback':
        value = Client.fallback
    else:
        value = sigmoid(cache_age(r), Client.cache_age_max, Client.cache_age_k)

    return value * sigmoid(r.latency(), Client.decay_max, Client.decay_k)


def sample():
    return int(exponential(Client.key_space))


def dependency():
    t = normal(Dependency.mean, Dependency.std)
    if t > Dependency.timeout:
        return Dependency.timeout, 'timeout'

    return t, 'success' if (coin_toss(Dependency.availability)) else 'failure'


def priority(r):
    return 1

#
# Report
#


def _by_type(reqs, response_type):
    return [r for r in completed if r.response_type == response_type]


def _avg(values):
    if len(values) == 0:
        return 0
    return sum(values)/len(values)


def _avg_latency(reqs):
    return _avg([r.latency() for r in reqs])


def _avg_qos(reqs):
    return _avg([qos(r) for r in reqs])


def _avg_tries(reqs):
    return _avg([r.tries for r in reqs])


def _avg_queue_t(reqs, q_name):
    return _avg([r.queue_t[q_name] for r in reqs])


def _avg_dep_t(reqs):
    return _avg([r.dependency_t for r in reqs])


def _stats_header():
    print('-' * 57)
    print("%9s %5s %6s %6s %6s %6s %6s %6s" %
          ('type', 'count', 'qos', 'tries', 'time', 'q1', 'q2', 'dep'))
    print('-' * 57)


def _stats_row(label, reqs):
    print("%9s %5d %6.2f %6.1f %6.1f %6.1f %6.1f %6.1f" %
          (label, len(reqs),
           _avg_qos(reqs),
           _avg_tries(reqs),
           _avg_latency(reqs),
           _avg_queue_t(reqs, 'q1'),
           _avg_queue_t(reqs, 'q2'),
           _avg_dep_t(reqs)))


def stats(reqs=None):
    if not reqs:
        reqs = completed

    return {
        'count': len(reqs),
        'qos': _avg_qos(reqs),
        'tries': _avg_tries(reqs),
        'latency': _avg_latency(reqs),
        'q1': _avg_queue_t(reqs, 'q1'),
        'q2': _avg_queue_t(reqs, 'q2'),
        'dependency': _avg_dep_t(reqs)}


def report():
    # Leaving this as an inefficient bunch of loops until we know what we want to report
    _stats_header()
    _stats_row('all', completed)

    for t in ['rejected', 'cached', 'live', 'fallback']:
        _stats_row(t, _by_type(completed, t))

    print()

    if Server.ttl > 0:
        reqs = [r for r in completed if r.response_type != 'rejected']
        hits = [r for r in reqs if cache_hit(r)]
        print("cache hits %d/%d = %.2f" %
              (len(hits), len(reqs), len(hits)/len(reqs)))
        hits = [r for r in reqs if r.cache_ts]
        print("   entries %d/%d = %.2f" %
              (len(hits), len(reqs), len(hits)/len(reqs)))

#
# Main loop
#


def enqueue_or_respond(q2, r):
    if q2.full(Server.q2_max):
        respond(r)  # essentially the eviction case
        # print("%d %s" % (clock.ts, r.response_type))

    else:
        q2.enqueue(r)


def respond(r, response_type=None):
    if not r.responded:
        r.response_type = response_type if response_type else response(r)
        r.end_ts = clock.ts
        r.responded = True
        completed.append(r)


def main(ticks):
    global p1, p2

    while clock.ts < ticks:
        clock.tick()
        configure()

        # Process existing p2 work (ie, check on workers waiting on dependency)
        #
        p2_complete = complete(p2)
        p2 = not_complete(p2)
        for w in p2_complete:
            w.r.tries += 1

            if w.result == 'success':
                cache.write(w.r.key)
                respond(w.r, 'live')

            else:  # for possible retry
                enqueue_or_respond(q2, w.r)

        # Process p1 work: read from q1, read from cache and write to q2
        #
        p1 = not_complete(p1)
        while (not q1.empty()) and (len(p1) < Server.p1_max):
            worker = P1Worker(q1.dequeue())
            p1.append(worker)

        # Make abandonment decisions
        #
        for r in q2.items:
            decision = abandon(r)
            if decision == 'reneg':
                q2.remove(r)
                respond(r)

            elif decision == 'split':
                respond(r)

        # Process "new" p2 work (ie, handle some requests waiting in p2)
        #
        while (not q2.empty()) and (len(p2) < Server.p2_max):
            worker = P2Worker(q2.dequeue())
            p2.append(worker)

        # Process new request, if any
        #
        if clock.ts % Client.rate == 0:
            r = Request(sample())
            created.append(r)
            if q1.full(Server.q1_max):
                respond(r, 'rejected')

            else:
                q1.enqueue(r)


def setup():
    global clock, created, completed, cache, p1, p2, q1, q2
    p1 = []
    p2 = []
    created = []
    completed = []
    cache = Cache()
    q1 = Queue('q1')
    q2 = Queue('q2')
    cache = Cache()
    clock = Clock()


def warmup(ticks=500000):
    global created, completed
    setup()
    main(ticks)
    created = []
    completed = []


def run_experiment(ticks):
    main(clock.ts + ticks)
    report()


if __name__ == '__main__':
    warmup()
    run_experiment(500000)
