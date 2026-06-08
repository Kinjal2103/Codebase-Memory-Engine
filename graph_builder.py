# graph_builder.py — parses code AND loads it into Neo4j

import tree_sitter_python as tspython
from tree_sitter import Language, Parser
from neo4j import GraphDatabase

# ── 1. Set up tree-sitter (same as before) ──────────────────────────
PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

# ── 2. Connect to Neo4j ─────────────────────────────────────────────
# Make sure Neo4j is running before you run this script!
driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "password")   # change "password" to whatever you set
)

# ── 3. Parse the file ───────────────────────────────────────────────
FILENAME = "sample.py"

with open(FILENAME, "rb") as f:
    source_code = f.read()

tree = parser.parse(source_code)

# ── 4. Extract functions and calls ──────────────────────────────────
# We'll store: which functions exist, and which function calls which
functions = {}   # name -> {name, line, file}
calls = []       # list of {caller, callee}

# We need to track which function we're currently "inside"
# so we know who is making each call
current_function = [None]   # using a list so the inner function can modify it

def walk(node):
    if node.type == "function_definition":
        name_node = node.child_by_field_name("name")
        if name_node:
            func_name = source_code[name_node.start_byte:name_node.end_byte].decode()
            line = node.start_point[0] + 1
            functions[func_name] = {"name": func_name, "line": line, "file": FILENAME}

            # Remember: we're now inside this function
            previous = current_function[0]
            current_function[0] = func_name

            # Visit children (the body of this function)
            for child in node.children:
                walk(child)

            # When we leave this function, restore the previous context
            current_function[0] = previous
            return   # don't double-visit children below

    if node.type == "call":
        func_node = node.child_by_field_name("function")
        if func_node and current_function[0]:
            callee = source_code[func_node.start_byte:func_node.end_byte].decode()
            calls.append({
                "caller": current_function[0],
                "callee": callee,
                "line": node.start_point[0] + 1
            })

    for child in node.children:
        walk(child)

walk(tree.root_node)

print(f"Found {len(functions)} functions and {len(calls)} calls\n")

# ── 5. Load into Neo4j ──────────────────────────────────────────────
# Think of a "session" like opening a connection to the database
with driver.session() as session:

    # First, wipe any old data so we start fresh
    session.run("MATCH (n) DETACH DELETE n")
    print("Cleared old data from Neo4j")

    # Create a node for the file itself
    session.run(
        "CREATE (:File {name: $name})",
        name=FILENAME
    )

    # Create a node for every function we found
    # Cypher is Neo4j's query language — MERGE means
    # "create this node if it doesn't already exist"
    for func in functions.values():
        session.run("""
            MERGE (f:Function {name: $name})
            SET f.line = $line, f.file = $file
        """, name=func["name"], line=func["line"], file=func["file"])

        # Also connect it to the file with a DEFINES relationship
        session.run("""
            MATCH (file:File {name: $file})
            MATCH (func:Function {name: $fname})
            MERGE (file)-[:DEFINES]->(func)
        """, file=FILENAME, fname=func["name"])

    print(f"Created {len(functions)} Function nodes")

    # Create CALLS relationships between functions
    call_count = 0
    for call in calls:
        # Only create the relationship if both functions exist in our file
        # (this avoids linking to built-ins like print() that we didn't define)
        if call["caller"] in functions and call["callee"] in functions:
            session.run("""
                MATCH (caller:Function {name: $caller})
                MATCH (callee:Function {name: $callee})
                MERGE (caller)-[:CALLS {line: $line}]->(callee)
            """, caller=call["caller"], callee=call["callee"], line=call["line"])
            call_count += 1
            print(f"  {call['caller']}  -->CALLS-->  {call['callee']}  (line {call['line']})")

    print(f"\nCreated {call_count} CALLS relationships")

# ── 6. Now ask questions! ────────────────────────────────────────────
print("\n=== Querying the graph ===\n")

with driver.session() as session:

    # Q1: What does multiply() call?
    result = session.run("""
        MATCH (f:Function {name: 'multiply'})-[:CALLS]->(called)
        RETURN called.name AS name, called.line AS line
    """)
    print("multiply() calls:")
    for row in result:
        print(f"  → {row['name']} (defined at line {row['line']})")

    # Q2: THE BIG ONE — if I change add(), what might break?
    result = session.run("""
        MATCH (affected)-[:CALLS*1..5]->(f:Function {name: 'add'})
        RETURN DISTINCT affected.name AS name
    """)
    print("\nIf add() changes, these functions could break:")
    for row in result:
        print(f"  ⚠  {row['name']}")

driver.close()
print("\nDone!")