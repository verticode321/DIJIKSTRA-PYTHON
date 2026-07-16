import sqlite3
import random

NUM_NODES = 5000
EDGES_PER_NODE = 4  # ~20,000 edges total

conn = sqlite3.connect("graph.db")
cur = conn.cursor()

cur.executescript("""
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS nodes;

CREATE TABLE nodes (
    id INTEGER PRIMARY KEY
);

CREATE TABLE edges (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    source INTEGER NOT NULL,
    target INTEGER NOT NULL,
    weight INTEGER NOT NULL
);
""")

# Insert 5000 nodes
cur.executemany("INSERT INTO nodes (id) VALUES (?)", [(i,) for i in range(NUM_NODES)])

edges = []
for i in range(NUM_NODES):
    # Ring edge — guarantees connectivity
    j = (i + 1) % NUM_NODES
    w = random.randint(1, 50)
    edges.append((i, j, w))
    edges.append((j, i, w))  # undirected

    # Extra random edges
    for _ in range(EDGES_PER_NODE - 1):
        target = random.randint(0, NUM_NODES - 1)
        if target != i:
            w = random.randint(1, 100)
            edges.append((i, target, w))

cur.executemany("INSERT INTO edges (source, target, weight) VALUES (?, ?, ?)", edges)
conn.commit()
conn.close()

print(f"Generated {NUM_NODES} nodes and {len(edges)} edges into graph.db")
