export interface OpenTab {
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

export function buildTree(files: { path: string }[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);
      if (existing && !isFile) {
        current = existing.children!;
      } else if (!existing) {
        const node: TreeNode = {
          name,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "dir",
          children: isFile ? undefined : [],
        };
        current.push(node);
        if (!isFile) current = node.children!;
      }
    }
  }
  return root;
}

export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    md: "markdown", json: "json", csv: "plaintext",
    py: "python", ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript", txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}
