import quartermaster as qm
# from itertools import zip

# There are many situations where a dependency's latency may be best modeled by two (or more) different distrubtions, corresponding to different "cases" for the dependency. Here is a necessarily, incomplete list of such situations: (1) the dependency has a cache and a cache hit has lower mean latency than a cache miss, (2) the dependency is memory constrained and when garbage collection coincides with a request, that request has higher latency, (3) due to a hardware failure (say) one host in the fleet running the dependency always fails requests, and does so with high latency, and (4) the dependency is overloaded and load shedding leads to some proportion of requests being immediately rejected. Situations (2) and (3) are similar in that the normal case has lower latency than some exceptional case. Also, both situations imply a kind of degredation we may want our server to be tolerant to, to the extent possible.

# To guard against the high latency cases, the server will enforce a timeout value on the call to the dependency and use retry or fallback strategies in the event that the call times-out. Our goal here is to explore under what circumstances such an approach is effective at improving overall QoS, by reducing latency and increasing availability. The intuition behind this is, as more time passes, the probability of the request being in the case for the distribution with the smaller mean goes down. Also, if the probability of falling into the degraded case twice in a row is low (which it likely is if the events are statistically independent), a retry may help. Maybe a better wording: the frequency of the slow case, influences the probability of getting at least one "normal" case over the course of multiple tries.

# More formally, if y is the random variable representing the full duration of the request and x is the length of time a request has taken so far the probability of a reqeust being in the case with the smaller mean is P(y>x) for the distribution. Though, of course, the server may not know what the distributions are.

# SETUP and RESULTS

# From a modeling stand point, situation (2) and (3) are the same, except that for situation (3) the availability for the second case (ie, the slow case) is 0. We will model the dependencies latency using two normal distributions (ie, one for the normal case and one for the slow case). The mean for the normal case will be 100 and we will try several different means for the slow case (200,300,400 and 500). We also will extend the dependency function to use a new configuration parameter that determines how likely the normal case is (0.75, for this exploration).


normal_mean = 100
slow_mean = 200
std = 25


def dependency():
    normal_case_probability = 0.75

    if qm.coin_toss(normal_case_probability):  # case 1
        mean = normal_mean
        availability = 0.98

    else:  # case 2 (the "slow" case)
        mean = slow_mean
        availability = 0

    t = qm.normal(mean, std)
    if t > timeout:
        return timeout, 'timeout'

    return t, 'success' if (qm.coin_toss(availability)) else 'failure'


qm.dependency = dependency  # override the normal dependency function

# In neither situation will we use a cache, so that we can focus specifically on the effects of timeouts and retries. Otherwise, we are using a "typical" (if such a thing exists) configuration for the server.

qm.Server.ttl = 0  # no caching
qm.Server.p1_max = 10
qm.Server.p2_max = 5
qm.Server.q1_max = 10
qm.Server.q2_max = 12

# We will use the sigmoid QoS function described above and same rate of request arrival for both situations.

qm.Client.decay_k = 4
qm.Client.rate = 50
qm.Client.decay_max = 500


# SIMULATIONS RUN

# The first exploration we ran uses a large timeout, while simulating situation (2). The idea here is that the server will wait for the response from the dependency even if we happen to hit the slow case.

stat_rows = []


def _add(stats):
    stats.update({
        'timeout': timeout,
        'slow_mean': slow_mean,
        'decay_max': qm.Client.decay_max,
        'max_tries': qm.Server.tries})

    stat_rows.append(stats)

# Recall, that the significance of the decay_max configuration parameter is that a response to the client that takes decay_max ticks or more will be valued at 0, and will be exploring 3 different decay_max values.


for slow_mean in [150, 200, 250, 300, 350, 400, 450, 500]:

    for qm.Server.tries in [2]:  # [1,2]:
        print("decay_max=%d; slow_mean=%d; tries=%d" %
              (qm.Client.decay_max, slow_mean, qm.Server.tries))

        # For each decay, mean and tries triple, we will try a large timeout--set to decay_max; there is no reason to wait longer because the request QoS will be 0 at that point.

        timeout = qm.Client.decay_max
        qm.setup()
        qm.run_experiment(200000)
        _add(qm.stats())

        timeout = normal_mean + 2*std
        qm.setup()
        qm.run_experiment(200000)
        _add(qm.stats())

print("decay_max, mean_delta, max_tries, timeout_1, qos_1, latency_1, timeout_2, qos_2, latency_2")
for i, j in zip(stat_rows[::2], stat_rows[1::2]):
    print("%d,%d,%d,%d,%.2f,%.2f,%d,%.2f,%.2f" %
          (i['decay_max'], i['slow_mean']-normal_mean, i['max_tries'],
           i['timeout'], i['qos'], i['latency'],
              j['timeout'], j['qos'], j['latency']))

# INSIGHTS

# - If the two cases are sufficiently different, a timeout value can be chosen such that if the request takes that long, then it is likely to be in the slow case.

# - If the mean latency in the slow case is more than timeout + the mean time in the normal case (or something like that), timing out and retrying (at least) once may reduce overall latency.

# - How much the QoS function penalizes latency will determine whether or not a timeout (as compared to simply waiting for the original response) is advantageous, and the number of retries that are practically possible.

# Something similar is also likely to be true in situation (3), but in this case it may be even more benefitial to timeout and retry because otherwise the server is waiting for a request that is going to fail and need to be retried anyway (or be a fallback case).

# OTHER THOUGHTS

# The timeout (as it relates to the dependency's latency) and retry strategy affect the time it takes to handle a request and as a result, the rate of request arrival that can be supported, and the time that requests spend waiting in the two queues. The above uses a relatively low arrival rate to avoid this, which is convenient for explorations, but also under-sells the value of the aggressive timeout.

# None of the above uses a retry, yet.
