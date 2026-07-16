"""
server.py
---------
Flask HTTP server — Python replacement for the C++ main.cpp.

Loads the graph from graph.db (SQLite), then exposes:
  GET /api/info                                    → node count
  GET /api/shortest-path?source=0&dest=4999&threads=4 → seq + parallel results
"""

import sqlite3
import sys
import os
from flask import Flask, jsonify, request
from flask_cors import CORS

# dijkstra.py must be in the same folder
sys.path.insert(0, os.path.dirname(__file__))
from dijkstra import sequential_dijkstra, parallel_dijkstra

app = Flask(__name__)
CORS(app)  # Allow React frontend on port 3000

# ── Load graph from SQLite ─────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "graph.db")

def load_graph(db_path):
    conn = sqlite3.connect(db_path)
    cur  = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM nodes")
    num_nodes = cur.fetchone()[0]

    # Adjacency list: adj[u] = [(v, w), ...]
    adj = [[] for _ in range(num_nodes)]
    cur.execute("SELECT source, target, weight FROM edges")
    for (src, tgt, w) in cur.fetchall():
        if 0 <= src < num_nodes and 0 <= tgt < num_nodes:
            adj[src].append((tgt, w))

    conn.close()
    return num_nodes, adj

print("Loading graph from database...")
NUM_NODES, ADJ = load_graph(DB_PATH)
print(f"Graph loaded: {NUM_NODES} nodes")


# ── API Endpoints ──────────────────────────────────────────────────────────

@app.route("/api/info", methods=["GET"])
def api_info():
    return jsonify({"numNodes": NUM_NODES})


@app.route("/api/shortest-path", methods=["GET"])
def api_shortest_path():
    try:
        source  = int(request.args.get("source", 0))
        dest    = int(request.args.get("dest", 100))
        threads = int(request.args.get("threads", 4))
    except ValueError:
        return jsonify({"error": "source, dest, and threads must be integers"}), 400

    if not (0 <= source < NUM_NODES) or not (0 <= dest < NUM_NODES):
        return jsonify({"error": f"Node IDs must be between 0 and {NUM_NODES - 1}"}), 400

    if threads < 1 or threads > 16:
        return jsonify({"error": "threads must be between 1 and 16"}), 400

    # Run both implementations
    seq = sequential_dijkstra(ADJ, NUM_NODES, source, dest)
    par = parallel_dijkstra(ADJ, NUM_NODES, source, dest, threads)

    speedup = (seq["execution_time_ms"] / par["execution_time_ms"]
               if par["execution_time_ms"] > 0 else 0)

    return jsonify({
        "source":      source,
        "dest":        dest,
        "threadsUsed": threads,
        "sequential":  {
            "totalCost":       seq["total_cost"],
            "executionTimeMs": seq["execution_time_ms"],
            "path":            seq["path"],
        },
        "parallel": {
            "totalCost":       par["total_cost"],
            "executionTimeMs": par["execution_time_ms"],
            "path":            par["path"],
        },
        "speedup": round(speedup, 4),
    })


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Server running on http://localhost:8080")
    app.run(host="0.0.0.0", port=8080, debug=False)
