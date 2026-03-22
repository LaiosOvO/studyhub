//! Tauri commands for local AutoResearch execution.
//!
//! Follows Karpathy's autoresearch pattern on the client machine:
//! - Local git workspace (init, commit, reset)
//! - Real subprocess execution (python train.py)
//! - File system I/O (write/read code + output files)
//! - Metric extraction from stdout

use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Result of initializing a local workspace.
#[derive(Serialize)]
pub struct InitResult {
    pub run_id: String,
    pub workspace_path: String,
}

/// Result of writing code to workspace.
#[derive(Serialize)]
pub struct WriteResult {
    pub commit_sha: String,
    pub path: String,
}

/// Result of executing code.
#[derive(Serialize)]
pub struct ExecResult {
    pub exit_code: i32,
    pub duration_seconds: f64,
    pub stdout: String,
    pub stderr: String,
    pub metrics: HashMap<String, f64>,
    pub error: Option<String>,
}

/// Result of keep/discard decision.
#[derive(Serialize)]
pub struct DecideResult {
    pub head_sha: String,
    pub action: String,
}

/// Get the base workspace directory (~/studyhub-workspaces/).
fn workspace_base() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("studyhub-workspaces")
}

/// Get workspace path for a run, with traversal protection.
fn workspace_path(run_id: &str) -> Result<PathBuf, String> {
    if run_id.is_empty() || run_id.contains("..") || run_id.contains('/') || run_id.contains('\\')
    {
        return Err(format!("Invalid run_id: {run_id}"));
    }
    Ok(workspace_base().join(run_id))
}

/// Run a git command in the workspace directory.
async fn run_git(cwd: &PathBuf, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Git command failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "git {} failed ({}): {}",
            args.join(" "),
            output.status,
            stderr.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Resolve the full path of a command by searching common locations.
/// macOS GUI apps don't inherit shell PATH, so we search manually.
fn resolve_command(cmd: &str) -> String {
    // If already an absolute path, use it directly
    if cmd.starts_with('/') {
        return cmd.to_string();
    }

    // Common locations for python/pip/node etc. on macOS
    let search_paths = [
        "/usr/local/bin",
        "/usr/bin",
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        // Conda / pyenv / uv common paths
        "/Users",
    ];

    // For "python" also try "python3" and vice versa
    let candidates: Vec<&str> = if cmd == "python" {
        vec!["python", "python3"]
    } else if cmd == "python3" {
        vec!["python3", "python"]
    } else {
        vec![cmd]
    };

    // First: check if we can get PATH from a login shell
    for candidate in &candidates {
        if let Ok(output) = std::process::Command::new("/bin/zsh")
            .args(["-l", "-c", &format!("which {}", candidate)])
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() && std::path::Path::new(&path).exists() {
                    return path;
                }
            }
        }
    }

    // Fallback: search common paths
    for candidate in &candidates {
        for dir in &search_paths {
            let full = format!("{dir}/{candidate}");
            if std::path::Path::new(&full).exists() {
                return full;
            }
        }
    }

    // Last resort: return original and hope it works
    cmd.to_string()
}

/// Build a PATH environment variable that includes common macOS tool locations.
fn build_full_path() -> String {
    let defaults = [
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
    ];

    // Try to get the real PATH from a login shell
    if let Ok(output) = std::process::Command::new("/bin/zsh")
        .args(["-l", "-c", "echo $PATH"])
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }

    defaults.join(":")
}

/// Extract metrics from subprocess stdout.
/// Looks for patterns like "key: 1.234" or "key=1.234"
fn extract_metrics(stdout: &str) -> HashMap<String, f64> {
    let mut metrics = HashMap::new();
    let re = regex::Regex::new(
        r"(?m)^\s*([a-zA-Z_][\w./]*)\s*[:=]\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*$",
    );

    if let Ok(re) = re {
        for cap in re.captures_iter(stdout) {
            if let (Some(key), Some(val)) = (cap.get(1), cap.get(2)) {
                if let Ok(v) = val.as_str().parse::<f64>() {
                    metrics.insert(key.as_str().to_lowercase().replace(' ', "_"), v);
                }
            }
        }
    }

    // Also check last 20 lines for "key value" pairs
    let lines: Vec<&str> = stdout.lines().collect();
    let start = if lines.len() > 20 { lines.len() - 20 } else { 0 };
    for line in &lines[start..] {
        let parts: Vec<&str> = line.trim().split_whitespace().collect();
        if parts.len() == 2 {
            if let Ok(v) = parts[1].parse::<f64>() {
                metrics.insert(parts[0].to_lowercase(), v);
            }
        }
    }

    metrics
}

/// Initialize a local autoresearch workspace with git.
#[tauri::command]
pub async fn local_ar_init(
    run_id: String,
    base_code: Option<String>,
    prepare_code: Option<String>,
    requirements: Option<String>,
) -> Result<InitResult, String> {
    let ws = workspace_path(&run_id)?;

    // Create directory
    tokio::fs::create_dir_all(&ws)
        .await
        .map_err(|e| format!("Failed to create workspace: {e}"))?;

    // Git init
    if !ws.join(".git").exists() {
        run_git(&ws, &["init"]).await?;
        run_git(&ws, &["config", "user.email", "studyhub@local"]).await?;
        run_git(&ws, &["config", "user.name", "StudyHub"]).await?;

        // Initial commit
        let marker = ws.join(".studyhub");
        tokio::fs::write(&marker, format!("workspace: {run_id}\n"))
            .await
            .map_err(|e| format!("Write marker: {e}"))?;
        run_git(&ws, &["add", ".studyhub"]).await?;
        run_git(&ws, &["commit", "-m", "Initialize workspace"]).await?;
    }

    // Write initial files
    if let Some(code) = base_code {
        tokio::fs::write(ws.join("train.py"), &code)
            .await
            .map_err(|e| format!("Write train.py: {e}"))?;
        run_git(&ws, &["add", "train.py"]).await?;
        run_git(&ws, &["commit", "-m", "Initial train.py"]).await?;
    }

    if let Some(code) = prepare_code {
        tokio::fs::write(ws.join("prepare.py"), &code)
            .await
            .map_err(|e| format!("Write prepare.py: {e}"))?;
        run_git(&ws, &["add", "prepare.py"]).await?;
        run_git(&ws, &["commit", "-m", "Add prepare.py"]).await?;
    }

    if let Some(reqs) = requirements {
        tokio::fs::write(ws.join("requirements.txt"), &reqs)
            .await
            .map_err(|e| format!("Write requirements.txt: {e}"))?;
        run_git(&ws, &["add", "requirements.txt"]).await?;
        run_git(&ws, &["commit", "-m", "Add requirements.txt"]).await?;
    }

    // Init results.tsv
    let results_path = ws.join("results.tsv");
    if !results_path.exists() {
        tokio::fs::write(
            &results_path,
            "iteration\tcommit\taction\tduration_s\texit_code\n",
        )
        .await
        .map_err(|e| format!("Write results.tsv: {e}"))?;
        run_git(&ws, &["add", "results.tsv"]).await?;
        run_git(&ws, &["commit", "-m", "Initialize results.tsv"]).await?;
    }

    Ok(InitResult {
        run_id,
        workspace_path: ws.to_string_lossy().to_string(),
    })
}

/// Write a file to the local workspace and git commit.
#[tauri::command]
pub async fn local_ar_write_code(
    run_id: String,
    path: String,
    content: String,
    message: Option<String>,
) -> Result<WriteResult, String> {
    let ws = workspace_path(&run_id)?;

    // Validate path doesn't escape workspace
    if path.contains("..") {
        return Err("Invalid file path".to_string());
    }

    let file_path = ws.join(&path);

    // Create parent dirs
    if let Some(parent) = file_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Create dirs: {e}"))?;
    }

    tokio::fs::write(&file_path, &content)
        .await
        .map_err(|e| format!("Write file: {e}"))?;

    run_git(&ws, &["add", &path]).await?;

    // Check if there are changes to commit
    let diff_result = Command::new("git")
        .args(["diff", "--cached", "--quiet"])
        .current_dir(&ws)
        .output()
        .await;

    let has_changes = match diff_result {
        Ok(output) => !output.status.success(),
        Err(_) => true,
    };

    if has_changes {
        let msg = message.unwrap_or_else(|| format!("Update {path}"));
        run_git(&ws, &["commit", "-m", &msg]).await?;
    }

    let sha = run_git(&ws, &["rev-parse", "HEAD"]).await?;

    Ok(WriteResult {
        commit_sha: sha,
        path,
    })
}

/// Execute a command in the local workspace via subprocess.
#[tauri::command]
pub async fn local_ar_execute(
    run_id: String,
    command: Option<String>,
    timeout_seconds: Option<u64>,
    env_vars: Option<HashMap<String, String>>,
    app: AppHandle,
) -> Result<ExecResult, String> {
    let ws = workspace_path(&run_id)?;
    let cmd = command.unwrap_or_else(|| "python train.py".to_string());
    let timeout = timeout_seconds.unwrap_or(86400); // default 24h, no cap

    // Split command and resolve the executable path
    let parts: Vec<&str> = cmd.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty command".to_string());
    }

    let start = std::time::Instant::now();

    // Resolve the executable (e.g. "python" → "/opt/homebrew/anaconda3/bin/python")
    let resolved_exe = resolve_command(parts[0]);
    let full_cmd = if parts.len() > 1 {
        format!("'{}' {}", resolved_exe, parts[1..].join(" "))
    } else {
        format!("'{}'", resolved_exe)
    };

    // Run through login shell to inherit conda/pyenv/etc. environment
    let shell_script = format!(
        "cd '{}' && PYTHONUNBUFFERED=1 PYTHONPATH='{}' {}",
        ws.to_string_lossy(),
        ws.to_string_lossy(),
        full_cmd
    );

    let mut child_cmd = Command::new("/bin/zsh");
    child_cmd
        .args(["-l", "-c", &shell_script])
        .current_dir(&ws)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(vars) = env_vars {
        for (k, v) in vars {
            child_cmd.env(k, v);
        }
    }

    let mut child = child_cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn: {e}"))?;

    // Stream stdout lines as events
    let stdout_handle = child.stdout.take();
    let stderr_handle = child.stderr.take();

    let app_clone = app.clone();
    let run_id_clone = run_id.clone();

    // Collect stdout with streaming
    let stdout_task = tokio::spawn(async move {
        let mut lines = Vec::new();
        if let Some(stdout) = stdout_handle {
            let reader = BufReader::new(stdout);
            let mut line_reader = reader.lines();
            while let Ok(Some(line)) = line_reader.next_line().await {
                // Emit each line as event for real-time display
                let _ = app_clone.emit(
                    "autoresearch-stdout",
                    serde_json::json!({
                        "run_id": run_id_clone,
                        "line": line,
                    }),
                );
                lines.push(line);
            }
        }
        lines.join("\n")
    });

    // Collect stderr
    let stderr_task = tokio::spawn(async move {
        let mut output = String::new();
        if let Some(stderr) = stderr_handle {
            let reader = BufReader::new(stderr);
            let mut line_reader = reader.lines();
            while let Ok(Some(line)) = line_reader.next_line().await {
                output.push_str(&line);
                output.push('\n');
            }
        }
        output
    });

    // Wait with timeout
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(timeout),
        child.wait(),
    )
    .await;

    let duration = start.elapsed().as_secs_f64();

    match result {
        Ok(Ok(exit_status)) => {
            let stdout = stdout_task.await.unwrap_or_default();
            let stderr = stderr_task.await.unwrap_or_default();

            // Truncate long outputs
            let max_len = 50_000;
            let stdout_trunc = if stdout.len() > max_len {
                format!("... (truncated) ...\n{}", &stdout[stdout.len() - max_len..])
            } else {
                stdout.clone()
            };
            let stderr_trunc = if stderr.len() > max_len {
                format!("... (truncated) ...\n{}", &stderr[stderr.len() - max_len..])
            } else {
                stderr
            };

            let exit_code = exit_status.code().unwrap_or(-1);
            let metrics = extract_metrics(&stdout);

            Ok(ExecResult {
                exit_code,
                duration_seconds: (duration * 100.0).round() / 100.0,
                stdout: stdout_trunc,
                stderr: stderr_trunc,
                metrics,
                error: if exit_code != 0 {
                    Some(format!("Exit code: {exit_code}"))
                } else {
                    None
                },
            })
        }
        Ok(Err(e)) => {
            let _ = stdout_task.await;
            let _ = stderr_task.await;
            Ok(ExecResult {
                exit_code: -2,
                duration_seconds: (duration * 100.0).round() / 100.0,
                stdout: String::new(),
                stderr: String::new(),
                metrics: HashMap::new(),
                error: Some(format!("Process error: {e}")),
            })
        }
        Err(_) => {
            // Timeout - kill the process
            let _ = child.kill().await;
            let _ = stdout_task.await;
            let _ = stderr_task.await;
            Ok(ExecResult {
                exit_code: -1,
                duration_seconds: (duration * 100.0).round() / 100.0,
                stdout: String::new(),
                stderr: String::new(),
                metrics: HashMap::new(),
                error: Some(format!("Timeout after {timeout}s")),
            })
        }
    }
}

/// Keep or discard the last commit.
/// keep=true: keep commit, keep=false: git reset --hard HEAD~1
#[tauri::command]
pub async fn local_ar_decide(
    run_id: String,
    keep: bool,
    iteration: u32,
    commit_sha: Option<String>,
    duration: Option<f64>,
    exit_code: Option<i32>,
    extra_metrics: Option<HashMap<String, f64>>,
) -> Result<DecideResult, String> {
    let ws = workspace_path(&run_id)?;

    if !keep {
        run_git(&ws, &["reset", "--hard", "HEAD~1"]).await?;
    }

    let head_sha = run_git(&ws, &["rev-parse", "HEAD"]).await?;
    let action = if keep { "keep" } else { "discard" };

    // Append to results.tsv
    let results_path = ws.join("results.tsv");
    let sha_short = commit_sha
        .as_deref()
        .unwrap_or(&head_sha)
        .get(..8)
        .unwrap_or("????????");
    let dur = duration.unwrap_or(0.0);
    let ec = exit_code.unwrap_or(0);

    let mut row = format!("{iteration}\t{sha_short}\t{action}\t{dur:.1}\t{ec}");
    if let Some(metrics) = extra_metrics {
        for (k, v) in metrics.iter() {
            row.push_str(&format!("\t{k}={v}"));
        }
    }
    row.push('\n');

    tokio::fs::OpenOptions::new()
        .append(true)
        .open(&results_path)
        .await
        .map_err(|e| format!("Open results.tsv: {e}"))?
        .write_all(row.as_bytes())
        .await
        .map_err(|e| format!("Write results.tsv: {e}"))?;

    Ok(DecideResult {
        head_sha,
        action: action.to_string(),
    })
}

/// Read a file from the local workspace.
#[tauri::command]
pub async fn local_ar_read_file(run_id: String, path: String) -> Result<String, String> {
    let ws = workspace_path(&run_id)?;
    if path.contains("..") {
        return Err("Invalid path".to_string());
    }
    let file_path = ws.join(&path);
    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Read {path}: {e}"))
}

/// Write a file to the local workspace (without git commit).
#[tauri::command]
pub async fn local_ar_write_file(
    run_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    let ws = workspace_path(&run_id)?;
    if path.contains("..") {
        return Err("Invalid path".to_string());
    }
    let file_path = ws.join(&path);
    if let Some(parent) = file_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Create dirs: {e}"))?;
    }
    tokio::fs::write(&file_path, &content)
        .await
        .map_err(|e| format!("Write {path}: {e}"))
}

/// List files in the workspace (tracked + untracked).
#[tauri::command]
pub async fn local_ar_list_files(run_id: String) -> Result<Vec<String>, String> {
    let ws = workspace_path(&run_id)?;
    if !ws.join(".git").exists() {
        return Ok(vec![]);
    }
    // Tracked files
    let tracked = run_git(&ws, &["ls-files"]).await?;
    // Untracked files (excluding .git internals)
    let untracked = run_git(&ws, &["ls-files", "--others", "--exclude-standard"]).await.unwrap_or_default();

    let mut files: Vec<String> = tracked.lines()
        .chain(untracked.lines())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();
    files.sort();
    files.dedup();
    Ok(files)
}

/// Get git log for the workspace.
#[tauri::command]
pub async fn local_ar_git_log(
    run_id: String,
    limit: Option<u32>,
) -> Result<Vec<serde_json::Value>, String> {
    let ws = workspace_path(&run_id)?;
    if !ws.join(".git").exists() {
        return Ok(vec![]);
    }

    let limit_str = format!("--max-count={}", limit.unwrap_or(50));
    let output = run_git(
        &ws,
        &["log", &limit_str, "--format=%H|%s|%aI|%an", "--name-only"],
    )
    .await?;

    let mut commits = Vec::new();
    for block in output.split("\n\n") {
        let lines: Vec<&str> = block.trim().lines().collect();
        if lines.is_empty() {
            continue;
        }
        let parts: Vec<&str> = lines[0].splitn(4, '|').collect();
        if parts.len() < 4 {
            continue;
        }
        let files: Vec<&str> = lines[1..].iter().filter(|l| !l.is_empty()).copied().collect();
        commits.push(serde_json::json!({
            "sha": parts[0],
            "message": parts[1],
            "date": parts[2],
            "author": parts[3],
            "files_changed": files,
        }));
    }

    Ok(commits)
}

use tokio::io::AsyncWriteExt;

/// Default LabClaw skill base path (overridable via base_path parameter)
const LABCLAW_SKILLS_BASE: &str = "/Users/admin/ai/ref/LabClaw/skills";

/// Read a LabClaw skill file by relative path.
/// E.g. skill_path = "general/scientific-writing/SKILL.md"
/// Optional base_path overrides the default skill directory.
#[tauri::command]
pub async fn read_skill_file(skill_path: String, base_path: Option<String>) -> Result<String, String> {
    // Prevent directory traversal
    if skill_path.contains("..") {
        return Err("Invalid skill path".to_string());
    }
    let base = base_path.as_deref().unwrap_or(LABCLAW_SKILLS_BASE);
    let full_path = format!("{}/{}", base, skill_path);
    tokio::fs::read_to_string(&full_path)
        .await
        .map_err(|e| format!("Read skill: {e}"))
}
