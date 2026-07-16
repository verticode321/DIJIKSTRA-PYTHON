# Dijkstra's Shortest Path — Python Implementation
## Parallel Implementation using Python multiprocessing (OpenMP equivalent)

---

## Project Structure

```
dijkstra-python/
├── database/
│   └── generate_db.py     ← Creates graph.db (5000 nodes, ~20000 edges)
├── backend/
│   ├── dijkstra.py        ← Sequential + Parallel Dijkstra algorithm
│   └── server.py          ← Flask HTTP server (replaces C++ main.cpp)
└── frontend/
    ├── src/
    │   ├── App.jsx         ← React UI
    │   └── index.js
    ├── public/index.html
    └── package.json
```

---

## Languages & Libraries Used

| Component       | Language / Library                        |
|-----------------|-------------------------------------------|
| Algorithm       | Python                                    |
| Parallelism     | `multiprocessing` (Python's OpenMP equiv) |
| Database        | SQLite (via `sqlite3` built-in module)    |
| Backend Server  | Flask + flask-cors                        |
| Frontend UI     | React 18 + Tailwind CSS                   |

---

## How to Run — Step by Step

### Prerequisites
- Python 3.8+
- Node.js 16+ and npm
- pip

---

### STEP 1 — Install Python dependencies

```bash
pip install flask flask-cors
```

---

### STEP 2 — Generate the Database

```bash
cd database
python generate_db.py
```

**Expected output:**
```
Generated 5000 nodes and 20000 edges into graph.db
```

Then copy `graph.db` into the backend folder:
```bash
cp graph.db ../backend/
```

---

### STEP 3 — Start the Backend Server

```bash
cd ../backend
python server.py
```

**Expected output:**
```
Loading graph from database...
Graph loaded: 5000 nodes
Server running on http://localhost:8080
```

Leave this terminal open.

---

### STEP 4 — Start the Frontend

Open a **new terminal**:

```bash
cd ../frontend
npm install
npm start
```

Opens browser at `http://localhost:3000` automatically.

---

## Expected Output on Screen

The web UI shows:
- **Graph loaded: 5,000 nodes** from SQLite DB
- Input: Source Node, Destination Node, Number of Worker Processes
- After clicking **Run Dijkstra**:

| Sequential              | Parallel (4 processes)      |
|-------------------------|-----------------------------|
| Total Cost: e.g. 245    | Total Cost: 245 (same)      |
| Time: e.g. 320.5 ms     | Time: e.g. 140.2 ms         |
| Path: 0 → 12 → 87 → …  | Same path                   |

- **Speedup: ~2.28×**
- Visual bar chart comparing the two times

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/info` | Returns `{ "numNodes": 5000 }` |
| `GET /api/shortest-path?source=0&dest=4999&threads=4` | Runs both algorithms, returns results |

---

## How Parallelism Works (Python multiprocessing = OpenMP)

The C++ version used `#pragma omp parallel for`. In Python, `multiprocessing.Pool`
achieves the same effect — it spawns real OS-level parallel processes (not threads),
bypassing Python's GIL.

**Two steps are parallelized per Dijkstra iteration:**

1. **Find minimum unvisited node** — node list is split into chunks, each worker
   scans its chunk and returns a local minimum. The master picks the global minimum.
   *(Equivalent to OpenMP critical section merge)*

2. **Relax neighbors** — neighbor list of node `u` is split across workers.
   Each worker computes tentative distances and returns updates.
   Master applies them. *(Equivalent to OpenMP parallel for with critical)*
