use git2::Repository;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub hash:      String,    // short (7 chars)
    pub full_hash: String,
    pub message:   String,    // first line only
    pub author:    String,
    pub email:     String,
    pub timestamp: u64,       // unix seconds
    pub files:     Vec<String>,
}

pub fn get_log(repo: &Repository, max_count: usize, file_path: Option<&str>) -> Result<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut commits = Vec::with_capacity(max_count.min(50));

    'outer: for oid in revwalk.take(500) {
        if commits.len() >= max_count { break; }
        let oid = match oid { Ok(o) => o, Err(_) => continue };
        let commit = match repo.find_commit(oid) { Ok(c) => c, Err(_) => continue };

        // If filtering by file, check if this commit touches it
        if let Some(fp) = file_path {
            let tree = match commit.tree() { Ok(t) => t, Err(_) => continue };
            let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

            let diff = match repo.diff_tree_to_tree(
                parent_tree.as_ref(), Some(&tree), None,
            ) {
                Ok(d)  => d,
                Err(_) => continue,
            };

            let mut found = false;
            for _ in diff.deltas().filter(|d| {
                d.new_file().path().map(|p| p.to_string_lossy().contains(fp)).unwrap_or(false)
                || d.old_file().path().map(|p| p.to_string_lossy().contains(fp)).unwrap_or(false)
            }) {
                found = true;
                break;
            }
            if !found { continue 'outer; }
        }

        let message = commit.message().unwrap_or("").lines().next().unwrap_or("").to_string();
        let author  = commit.author();
        let hash    = oid.to_string();

        // Collect changed files (limit to 10 per commit for speed)
        let mut changed_files = Vec::new();
        let tree = match commit.tree() { Ok(t) => t, Err(_) => { commits.push(CommitInfo {
            hash:      hash[..7.min(hash.len())].to_string(),
            full_hash: hash,
            message,
            author:    author.name().unwrap_or("").to_string(),
            email:     author.email().unwrap_or("").to_string(),
            timestamp: author.when().seconds() as u64,
            files:     vec![],
        }); continue; }};

        if let Some(parent) = commit.parent(0).ok() {
            if let Ok(parent_tree) = parent.tree() {
                if let Ok(diff) = repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), None) {
                    for delta in diff.deltas().take(10) {
                        if let Some(p) = delta.new_file().path() {
                            changed_files.push(p.to_string_lossy().into_owned());
                        }
                    }
                }
            }
        }

        commits.push(CommitInfo {
            hash:      hash[..7.min(hash.len())].to_string(),
            full_hash: hash,
            message,
            author:    author.name().unwrap_or("").to_string(),
            email:     author.email().unwrap_or("").to_string(),
            timestamp: author.when().seconds() as u64,
            files:     changed_files,
        });
    }

    Ok(commits)
}
