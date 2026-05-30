use git2::{Repository, BranchType};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name:      String,
    pub is_head:   bool,
    pub is_remote: bool,
    pub commit:    String,   // short hash
    pub message:   String,   // last commit message (first line)
}

pub fn list_branches(repo: &Repository) -> Result<Vec<BranchInfo>> {
    let mut branches = Vec::new();

    // Local branches
    for branch in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("").to_string();
        if name.is_empty() { continue; }

        let is_head = branch.is_head();
        let (commit, message) = branch.get().peel_to_commit()
            .map(|c| {
                let hash = c.id().to_string();
                let msg  = c.message().unwrap_or("").lines().next().unwrap_or("").to_string();
                (hash[..7.min(hash.len())].to_string(), msg)
            })
            .unwrap_or_default();

        branches.push(BranchInfo { name, is_head, is_remote: false, commit, message });
    }

    // Remote branches (limited to 20)
    for branch in repo.branches(Some(BranchType::Remote))?.take(20) {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("").to_string();
        if name.is_empty() || name.ends_with("/HEAD") { continue; }

        let (commit, message) = branch.get().peel_to_commit()
            .map(|c| {
                let hash = c.id().to_string();
                let msg  = c.message().unwrap_or("").lines().next().unwrap_or("").to_string();
                (hash[..7.min(hash.len())].to_string(), msg)
            })
            .unwrap_or_default();

        branches.push(BranchInfo { name, is_head: false, is_remote: true, commit, message });
    }

    // Sort: HEAD first, then local by name, then remotes
    branches.sort_by(|a, b| {
        if a.is_head { return std::cmp::Ordering::Less; }
        if b.is_head { return std::cmp::Ordering::Greater; }
        a.is_remote.cmp(&b.is_remote).then(a.name.cmp(&b.name))
    });

    Ok(branches)
}
