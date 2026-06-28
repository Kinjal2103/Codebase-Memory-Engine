from tree_sitter import Language, Parser
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjs
from pathlib import Path

# Load Tree-sitter languages (using v0.21+ API syntax)
PY_LANGUAGE = Language(tspython.language())
JS_LANGUAGE = Language(tsjs.language())

def get_parser(language: str) -> Parser:
    """
    Initializes a Tree-sitter Parser configured for the specified language.
    """
    if language == "python":
        return Parser(PY_LANGUAGE)
    elif language in ("javascript", "typescript"):
        return Parser(JS_LANGUAGE)
    else:
        raise ValueError(f"Unsupported language: {language}")

def traverse_tree(node, code_bytes: bytes, file_rel_path: str, results: dict):
    """
    Recursively scans the AST of a file to extract functions, classes, and imports.
    """
    start_line = node.start_point[0] + 1
    end_line = node.end_point[0] + 1

    # 1. Class Extraction
    if node.type in ("class_definition", "class_declaration"):
        name_node = node.child_by_field_name("name")
        if not name_node:
            # Fallback to the first child of type 'identifier' if no 'name' field
            for child in node.children:
                if child.type == "identifier":
                    name_node = child
                    break
        class_name = name_node.text.decode("utf-8", errors="ignore") if name_node else "UnknownClass"
        results["classes"].append({
            "name": class_name,
            "start_line": start_line,
            "end_line": end_line
        })

    # 2. Function / Method Extraction
    elif node.type in ("function_definition", "function_declaration", "method_definition", "arrow_function"):
        func_name = None

        if node.type == "arrow_function":
            # Arrow functions are expressions. Check if parent is variable_declarator to find variable name
            parent = node.parent
            if parent and parent.type == "variable_declarator":
                name_node = parent.child_by_field_name("id")
                if not name_node:
                    for child in parent.children:
                        if child.type == "identifier":
                            name_node = child
                            break
                if name_node:
                    func_name = name_node.text.decode("utf-8", errors="ignore")
            
            if not func_name:
                # Default identifier name for anonymous functions
                clean_path = file_rel_path.replace("\\", "_").replace("/", "_").replace(".", "_")
                func_name = f"anonymous_{clean_path}_{start_line}"
        else:
            name_node = node.child_by_field_name("name")
            if not name_node:
                for child in node.children:
                    if child.type in ("identifier", "property_identifier"):
                        name_node = child
                        break
            if name_node:
                func_name = name_node.text.decode("utf-8", errors="ignore")
            else:
                clean_path = file_rel_path.replace("\\", "_").replace("/", "_").replace(".", "_")
                func_name = f"anonymous_{clean_path}_{start_line}"

        source_code = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
        results["functions"].append({
            "name": func_name,
            "start_line": start_line,
            "end_line": end_line,
            "source_code": source_code
        })

    # 3. Import Extraction
    elif node.type == "import_statement":
        source_node = node.child_by_field_name("source")
        if source_node:
            # JavaScript / TypeScript import (contains 'source' field indicating import path)
            source_module = source_node.text.decode("utf-8", errors="ignore").strip("'\"")
            
            import_clause = None
            for child in node.children:
                if child.type == "import_clause":
                    import_clause = child
                    break

            if import_clause:
                for child in import_clause.children:
                    if child.type == "identifier":
                        # Default import: e.g., import React from 'react'
                        results["imports"].append({
                            "imported_name": child.text.decode("utf-8", errors="ignore"),
                            "source_module": source_module
                        })
                    elif child.type == "namespace_import":
                        # Namespace import: e.g., import * as fs from 'fs'
                        for ns_child in child.children:
                            if ns_child.type == "identifier":
                                results["imports"].append({
                                    "imported_name": ns_child.text.decode("utf-8", errors="ignore"),
                                    "source_module": source_module
                                })
                    elif child.type == "named_imports":
                        # Named imports: e.g., import { useState } from 'react'
                        for specifier in child.children:
                            if specifier.type == "import_specifier":
                                name_node = specifier.child_by_field_name("alias") or specifier.child_by_field_name("name")
                                if not name_node:
                                    for spec_child in specifier.children:
                                        if spec_child.type == "identifier":
                                            name_node = spec_child
                                            break
                                if name_node:
                                    results["imports"].append({
                                        "imported_name": name_node.text.decode("utf-8", errors="ignore"),
                                        "source_module": source_module
                                    })
            else:
                # No clause (e.g. import 'styles.css')
                results["imports"].append({
                    "imported_name": source_module,
                    "source_module": None
                })
        else:
            # Python import_statement: e.g. import os, sys
            for child in node.children:
                if child.type == "dotted_name":
                    results["imports"].append({
                        "imported_name": child.text.decode("utf-8", errors="ignore"),
                        "source_module": None
                    })
                elif child.type == "aliased_import":
                    # e.g., import numpy as np
                    real_node = child.child_by_field_name("name") or child.children[0]
                    alias_node = child.child_by_field_name("alias") or child.children[-1]
                    imported = alias_node.text.decode("utf-8", errors="ignore") if alias_node else "unknown"
                    source = real_node.text.decode("utf-8", errors="ignore") if real_node else None
                    results["imports"].append({
                        "imported_name": imported,
                        "source_module": source
                    })

    elif node.type == "import_from_statement":
        # Python import_from_statement: e.g. from math import cos, sin as sine
        module_node = node.child_by_field_name("module_name")
        source_module = module_node.text.decode("utf-8", errors="ignore") if module_node else None

        import_started = False
        for child in node.children:
            if child.type == "import":
                import_started = True
                continue
            if import_started:
                if child.type == "dotted_name":
                    results["imports"].append({
                        "imported_name": child.text.decode("utf-8", errors="ignore"),
                        "source_module": source_module
                    })
                elif child.type == "aliased_import":
                    real_node = child.child_by_field_name("name") or child.children[0]
                    alias_node = child.child_by_field_name("alias") or child.children[-1]
                    imported = alias_node.text.decode("utf-8", errors="ignore") if alias_node else "unknown"
                    results["imports"].append({
                        "imported_name": imported,
                        "source_module": source_module
                    })
                elif child.type == "wildcard_import":
                    results["imports"].append({
                        "imported_name": "*",
                        "source_module": source_module
                    })

    # Recurse through all children
    for child in node.children:
        traverse_tree(child, code_bytes, file_rel_path, results)

def parse_file(file_path: str, rel_path: str, language: str) -> dict:
    """
    Parses a code file and extracts functions, classes, and imports.
    """
    results = {
        "functions": [],
        "classes": [],
        "imports": []
    }
    
    try:
        with open(file_path, "rb") as f:
            code_bytes = f.read()
    except Exception as e:
        print(f"Error: Failed to read file {file_path}: {e}")
        return results

    try:
        parser = get_parser(language)
        tree = parser.parse(code_bytes)
        traverse_tree(tree.root_node, code_bytes, rel_path, results)
    except Exception as e:
        print(f"Error: Failed to parse file {file_path}: {e}")

    return results
