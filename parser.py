# parser.py — reads a Python file and extracts functions + calls

import tree_sitter_python as tspython
from tree_sitter import Language, Parser

# Step 1: Set up the parser with the Python grammar
PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

# Step 2: Read your file
with open("sample.py", "rb") as f:        # "rb" = read as bytes (tree-sitter needs bytes)
    source_code = f.read()

# Step 3: Parse it — this gives us the tree
tree = parser.parse(source_code)

# Step 4: Walk the tree and find what we need
def extract_functions(node, code):
    """
    This function visits every node in the tree.
    When it finds a function_definition, it saves the name.
    When it finds a call_expression, it saves what's being called.
    """
    results = []

    # A recursive helper that visits every node
    def walk(node):
        # Is this node a function definition?
        if node.type == "function_definition":
            # The function name is always the first 'identifier' child
            name_node = node.child_by_field_name("name")
            if name_node:
                func_name = code[name_node.start_byte:name_node.end_byte].decode()
                line_number = node.start_point[0] + 1   # tree-sitter uses 0-based lines
                results.append({
                    "type": "function",
                    "name": func_name,
                    "line": line_number
                })

        # Is this node a function call?
        if node.type == "call":
            func_node = node.child_by_field_name("function")
            if func_node:
                call_name = code[func_node.start_byte:func_node.end_byte].decode()
                line_number = node.start_point[0] + 1
                results.append({
                    "type": "call",
                    "name": call_name,
                    "line": line_number
                })

        # Visit all children (this is how we scan the whole tree)
        for child in node.children:
            walk(child)

    walk(node)
    return results

# Run it!
findings = extract_functions(tree.root_node, source_code)

print("=== What we found in sample.py ===\n")
for item in findings:
    if item["type"] == "function":
        print(f"  FUNCTION  '{item['name']}'  defined at line {item['line']}")
    else:
        print(f"  CALL      '{item['name']}'  called at line {item['line']}")