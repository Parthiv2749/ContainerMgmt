import os

def print_tree(start_path, prefix=""):
    entries = sorted(os.listdir(start_path))
    entries_count = len(entries)

    for idx, entry in enumerate(entries):
        path = os.path.join(start_path, entry)
        connector = "└── " if idx == entries_count - 1 else "├── "
        print(prefix + connector + entry)
        if os.path.isdir(path):
            extension = "    " if idx == entries_count - 1 else "│   "
            print_tree(path, prefix + extension)

if __name__ == "__main__":
    root_dir = "."  # or specify any path
    print(root_dir)
    print_tree(root_dir)
