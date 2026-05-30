use napi_derive::napi;
use napi::bindgen_prelude::*;
use noter_git::GitRepo;

// ── Status ────────────────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsFileStatus {
    pub path:   String,
    pub status: String,
}

#[napi(object)]
pub struct JsRepoStatus {
    pub branch: String,
    pub ahead:  u32,
    pub behind: u32,
    pub files:  Vec<JsFileStatus>,
}

#[napi]
pub fn git_status(repo_path: String) -> Result<JsRepoStatus> {
    let repo   = GitRepo::open(&repo_path).map_err(|e| Error::from_reason(e.to_string()))?;
    let status = repo.status().map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(JsRepoStatus {
        branch: status.branch,
        ahead:  status.ahead  as u32,
        behind: status.behind as u32,
        files:  status.files.into_iter().map(|(path, st)| JsFileStatus {
            path, status: format!("{:?}", st).to_lowercase(),
        }).collect(),
    })
}

// ── Diff ──────────────────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsDiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header:    String,
}

#[napi(object)]
pub struct JsFileDiff {
    pub path:    String,
    pub status:  String,
    pub hunks:   Vec<JsDiffHunk>,
    pub added:   u32,
    pub deleted: u32,
}

#[napi(object)]
pub struct JsWorkspaceDiff {
    pub files: Vec<JsFileDiff>,
}

/// Get working-tree diff (unstaged changes). Pass file_path to filter to one file.
#[napi]
pub fn git_diff(repo_path: String, file_path: Option<String>) -> Result<JsWorkspaceDiff> {
    let repo = GitRepo::open(&repo_path).map_err(|e| Error::from_reason(e.to_string()))?;
    let diff = repo.diff(file_path.as_deref()).map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(JsWorkspaceDiff {
        files: diff.files.into_iter().map(|f| JsFileDiff {
            path:    f.path,
            status:  f.status,
            added:   f.added,
            deleted: f.deleted,
            hunks:   f.hunks.into_iter().map(|h| JsDiffHunk {
                old_start: h.old_start, old_lines: h.old_lines,
                new_start: h.new_start, new_lines: h.new_lines,
                header:    h.header,
            }).collect(),
        }).collect(),
    })
}

// ── Log ───────────────────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsCommitInfo {
    pub hash:      String,
    pub full_hash: String,
    pub message:   String,
    pub author:    String,
    pub email:     String,
    pub timestamp: f64,    // u64 → f64 for JS
    pub files:     Vec<String>,
}

/// Get commit log. max_count = number of commits, file_path filters to one file.
#[napi]
pub fn git_log(
    repo_path:  String,
    max_count:  u32,
    file_path:  Option<String>,
) -> Result<Vec<JsCommitInfo>> {
    let repo = GitRepo::open(&repo_path).map_err(|e| Error::from_reason(e.to_string()))?;
    let log  = repo.log(max_count as usize, file_path.as_deref())
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(log.into_iter().map(|c| JsCommitInfo {
        hash:      c.hash,
        full_hash: c.full_hash,
        message:   c.message,
        author:    c.author,
        email:     c.email,
        timestamp: c.timestamp as f64,
        files:     c.files,
    }).collect())
}

// ── Branches ─────────────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsBranchInfo {
    pub name:      String,
    pub is_head:   bool,
    pub is_remote: bool,
    pub commit:    String,
    pub message:   String,
}

/// List all local and remote branches.
#[napi]
pub fn git_branches(repo_path: String) -> Result<Vec<JsBranchInfo>> {
    let repo     = GitRepo::open(&repo_path).map_err(|e| Error::from_reason(e.to_string()))?;
    let branches = repo.branches().map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(branches.into_iter().map(|b| JsBranchInfo {
        name:      b.name,
        is_head:   b.is_head,
        is_remote: b.is_remote,
        commit:    b.commit,
        message:   b.message,
    }).collect())
}
