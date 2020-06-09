import quartermaster as qm

# To protect itself from unmanageable increases in traffic from teh client, a typical load-shedding strategy used by a server (or other system component) is to rejct any incoming requests that would exceed a configured (and usually, carefully chosen) maxium number of concurrent requests ($C_{max}$). The idea is that handling more than $C_{max} requests concurrently would degrade performance for all requests (either due to server or dependency resources). As the number of requests from the client increases, the proportion of rejected requests increases, which decreases the mean QoS.

# An alternative to this typical strategy is to use two (well, two or more, but we will just focus on two) thresholds ($C_1$ and $C_2$, say) to divide the requests into three, with group assignments happening at arrival time. Upto $C_1$ concurrent requests can be handled in the normal way and at the same time, upto $C_2$ concurrent requests can be handled using some less expensive processing. Then concurrent requests over and above $C_1 + C_2$ are rejected. The particulars of the less expensive processing of course will be application specific, but could include serving cached values (even, say stale values) and performing fallback behavior. Naturally, allocating resources to do this less expensive processing will reduce the number of requests that can be processed in the normal way, and the magnitude of this reduction will depend on the relative cost of the two types of processing.

# SETUP

# In Quartermaster, we can simulate such a strategy by controlling the sizes of $p_1,p_2,q_1$ and $q_2$ but we will focus on just $p_1$ and $p_2$, using a small fixed queue size throughout this exploration.

# We will assume that the inexpensive processing has 1/4 the cost of the normal processing. So $C_1 + C_2/4$ must be no more than $C_{max}$. If $C_2$ is 0, then we are using the typical load-shedding just described. If $C_1$ is 0, then no requests will be handled in the normal way. See table X for the values of we used for this exploration.

c_max = 4
qm.Server.q1_max = 1
qm.Server.q2_max = 1
qm.Server.ttl = 0

for c_1 in [4, 3, 2, 1, 0]:
    c_2 = (c_max - c_1)*4

    qm.Server.p2_max = c_1
    qm.Server.p1_max = c_1 + c_2

    print("C1=%d; C2=%d" % (c_1, c_2))
    print("\tp1=%d, p2=%d," % (qm.Server.p1_max, qm.Server.p2_max))

    # In this exploration we consider different arrival rates, each successively higher, so that we can simulate the server under increasing load levels.

    for qm.Client.rate in [50, 40, 30, 20, 10]:

        print("\n\t(rejected?) RATE=", qm.Client.rate)
        qm.warmup()
        qm.run_experiment(200000)
