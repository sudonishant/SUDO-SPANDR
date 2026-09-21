import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

print("File read successfully, size:", len(content))
