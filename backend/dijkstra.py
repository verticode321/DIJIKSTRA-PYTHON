"""
dijkstra.py
-----------
Sequential and Parallel implementations of Dijkstra's Shortest Path Algorithm.

Parallelism is achieved using Python's multiprocessing module, which is the
Python equivalent of OpenMP — it creates true OS-level parallel processes,
bypassing Python's Global Interpreter Lock (GIL).

Parallel strategy (mirrors the OpenMP approach in the original C++ code):
  1. "Find minimum unvisited node" step → split across worker processes,
     each finds its local minimum, then the master picks the global minimum.
  2. "Relax neighbors" step → distributed across processes.
"""

import heapq
import time
import math
from multiprocessing import Pool, cpu_count


# ──────────────────────────────────────────────
#  SEQUENTIAL DIJKSTRA
# ──────────────────────────────────────────────

def sequential_dijkstra(adj, num_nodes, src, dest):
    """
    Classic O((V + E) log V) Dijkstra using a min-heap.
    Single process, no parallelism.

    Returns:
        dict with keys: path, total_cost, execution_time_ms
    """
    t_start = time.perf_counter()

    INF = math.inf
    dist = [INF] * num_nodes
    prev = [-1]  * num_nodes
    dist[src] = 0

    # Min-heap: (distance, node)
    heap = [(0, src)]

    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        if u == dest:
            break
        for (v, w) in adj[u]:
            nd = dist[u] + w
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))

    t_end = time.perf_counter()
    elapsed_ms = (t_end - t_start) * 1000

    path = []
    if dist[dest] != INF:
        at = dest
        while at != -1:
            path.append(at)
            at = prev[at]
        path.reverse()

    return {
        "path": path,
        "total_cost": dist[dest] if dist[dest] != INF else -1,
        "execution_time_ms": elapsed_ms,
    }


# ──────────────────────────────────────────────
#  PARALLEL DIJKSTRA — WORKER FUNCTIONS
#  (must be module-level for multiprocessing)
# ──────────────────────────────────────────────

def _find_local_min(args):
    """
    Worker: scan a chunk of nodes and return the local minimum
    unvisited node with the smallest tentative distance.

    This mirrors the OpenMP parallel-for in the C++ code's
    "find minimum unvisited node" step.
    """
    node_range, dist, visited = args
    best_dist = math.inf
    best_node = -1
    for i in node_range:
        if not visited[i] and dist[i] < best_dist:
            best_dist = dist[i]
            best_node = i
    return best_node, best_dist


def _relax_chunk(args):
    """
    Worker: relax a subset of neighbors of the current node u.
    Returns a list of (node, new_distance, previous_node) updates.

    This mirrors the OpenMP parallel-for in the C++ code's
    "relax neighbors" step.
    """
    neighbors_chunk, dist_u, u = args
    updates = []
    for (v, w) in neighbors_chunk:
        nd = dist_u + w
        updates.append((v, nd, u))
    return updates


def parallel_dijkstra(adj, num_nodes, src, dest, num_threads=4):
    """
    Parallel Dijkstra using Python multiprocessing (equivalent of OpenMP).

    Two steps are parallelized per iteration:
      1. Finding the global minimum unvisited node (split across workers).
      2. Relaxing the neighbors of the chosen node (split across workers).

    Returns:
        dict with keys: path, total_cost, execution_time_ms
    """
    t_start = time.perf_counter()

    INF = math.inf
    dist    = [INF] * num_nodes
    prev    = [-1]  * num_nodes
    visited = [False] * num_nodes
    dist[src] = 0

    # Split node indices into chunks for parallel min-finding
    chunk_size = max(1, num_nodes // num_threads)
    node_chunks = [
        range(i, min(i + chunk_size, num_nodes))
        for i in range(0, num_nodes, chunk_size)
    ]

    with Pool(processes=num_threads) as pool:
        for _ in range(num_nodes):
            # ── STEP 1: Parallel find-minimum ──────────────────
            # Each worker scans its chunk and returns local min.
            # Master picks the global minimum (critical section merge).
            args_min = [(chunk, dist, visited) for chunk in node_chunks]
            local_results = pool.map(_find_local_min, args_min)

            u = -1
            best = INF
            for (node, d) in local_results:
                if d < best:
                    best = d
                    u = node

            if u == -1:
                break
            visited[u] = True
            if u == dest:
                break

            # ── STEP 2: Parallel neighbor relaxation ────────────
            neighbors = adj[u]
            if not neighbors:
                continue

            nc = max(1, len(neighbors) // num_threads)
            neighbor_chunks = [
                neighbors[i: i + nc] for i in range(0, len(neighbors), nc)
            ]
            args_relax = [(chunk, dist[u], u) for chunk in neighbor_chunks]
            all_updates = pool.map(_relax_chunk, args_relax)

            # Merge updates (critical section)
            for updates in all_updates:
                for (v, nd, pu) in updates:
                    if not visited[v] and nd < dist[v]:
                        dist[v] = nd
                        prev[v] = pu

    t_end = time.perf_counter()
    elapsed_ms = (t_end - t_start) * 1000

    path = []
    if dist[dest] != INF:
        at = dest
        while at != -1:
            path.append(at)
            at = prev[at]
        path.reverse()

    return {
        "path": path,
        "total_cost": dist[dest] if dist[dest] != INF else -1,
        "execution_time_ms": elapsed_ms,
    }
