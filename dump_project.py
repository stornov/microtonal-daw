from pathlib import Path
import argparse
import json

IGNORE_DIRS = {'.git', 'node_modules', 'dist', '.venv', 'venv', '__pycache__', '.idea', '.vscode'}
IGNORE_FILES = {'project-dump.md', 'project-dump.json'}
TEXT_EXTS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.css', '.html', '.svg',
    '.yml', '.yaml', '.toml', '.ini', '.cfg', '.sh', '.bat', '.ps1', '.env', '.xml', '.csv'
}

def is_text_file(path: Path) -> bool:
    name = path.name.lower()
    if name in IGNORE_FILES:
        return False
    return path.suffix.lower() in TEXT_EXTS or name in {'package.json', 'readme', 'license'} or path.name.startswith('.env')

def should_skip_dir(path: Path) -> bool:
    return path.name in IGNORE_DIRS

def build_tree(root: Path, prefix: str = '') -> str:
    entries = []
    for p in sorted(root.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        if p.name in IGNORE_FILES or should_skip_dir(p):
            continue
        entries.append(p)

    lines = []
    for i, p in enumerate(entries):
        connector = '└── ' if i == len(entries) - 1 else '├── '
        lines.append(f'{prefix}{connector}{p.name}{" /" if p.is_dir() else ""}')
        if p.is_dir():
            extension = '    ' if i == len(entries) - 1 else '│   '
            lines.append(build_tree(p, prefix + extension))
    return '\n'.join([line for line in lines if line])

def collect_files(root: Path):
    files = []
    for p in sorted(root.rglob('*')):
        if any(part in IGNORE_DIRS for part in p.parts):
            continue
        if p.is_file() and is_text_file(p):
            files.append(p)
    return files

def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return path.read_text(encoding='utf-8', errors='replace')

def infer_purpose(root: Path) -> str:
    pkg = root / 'package.json'
    if pkg.exists():
        try:
            data = json.loads(read_text(pkg))
            name = data.get('name', root.name)
            deps = data.get('dependencies', {})
            dev_deps = data.get('devDependencies', {})
            if 'react' in deps or 'react' in dev_deps:
                return f'Проект {name} выглядит как веб-приложение на React.'
            return f'Проект {name} — JavaScript/TypeScript-приложение.'
        except Exception:
            pass
    return f'Проект {root.name}.'

def make_markdown(root: Path) -> str:
    tree = build_tree(root)
    files = collect_files(root)
    purpose = infer_purpose(root)

    lines = []
    lines.append(f'# Project dump: {root.name}')
    lines.append('')
    lines.append('## Purpose')
    lines.append(purpose)
    lines.append('')
    lines.append('## Structure')
    lines.append('```text')
    lines.append(tree)
    lines.append('```')
    lines.append('')
    lines.append('## Files')

    for file in files:
        rel = file.relative_to(root).as_posix()
        lines.append(f'### `{rel}`')
        lines.append('```')
        lines.append(read_text(file).rstrip())
        lines.append('```')
        lines.append('')

    return '\n'.join(lines).rstrip() + '\n'

def main():
    parser = argparse.ArgumentParser(description='Create a markdown dump of a project.')
    parser.add_argument('root', nargs='?', default='.', help='Project root folder')
    parser.add_argument('-o', '--output', default='project-dump.md', help='Output markdown file')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    out = Path(args.output).resolve()
    md = make_markdown(root)
    out.write_text(md, encoding='utf-8')
    print(f'Saved: {out}')

if __name__ == '__main__':
    main()