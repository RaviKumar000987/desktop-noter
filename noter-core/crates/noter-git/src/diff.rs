use git2::{Repository, DiffOptions};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header:    String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub path:     String,
    pub status:   String,
    pub hunks:    Vec<DiffHunk>,
    pub added:    u32,
    pub deleted:  u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WorkspaceDiff {
    pub files: Vec<FileDiff>,
}

pub fn diff_index_to_workdir(repo: &Repository, file_path: Option<&str>) -> Result<WorkspaceDiff> {
    let mut opts = DiffOptions::new();
    opts.include_untracked(false);
    if let Some(p) = file_path { opts.pathspec(p); }

    let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
    let mut files: Vec<FileDiff> = Vec::new();

    diff.foreach(
        &mut |delta, _| {
            let path = delta.new_file().path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default();
            let status = format!("{:?}", delta.status()).to_lowercase();
            files.push(FileDiff { path, status, hunks: Vec::new(), added: 0, deleted: 0 });
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            if let Some(fd) = files.last_mut() {
                fd.hunks.push(DiffHunk {
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    header:    std::str::from_utf8(hunk.header()).unwrap_or("").trim().to_string(),
                });
            }
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            if let Some(fd) = files.last_mut() {
                match line.origin() {
                    '+' => fd.added   += 1,
                    '-' => fd.deleted += 1,
                    _   => {}
                }
            }
            true
        }),
    )?;

    Ok(WorkspaceDiff { files })
}
