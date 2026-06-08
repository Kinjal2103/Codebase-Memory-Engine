# sample.py  — this is the file we'll analyze

def add(x, y):
    return x + y

def multiply(x, y):
    result = add(x, y)   # add() is called here
    return result * 2

class Calculator:
    def __init__(self):
        self.history = []

    def run(self, x, y):
        return multiply(x, y)  # multiply() is called here