use git2::Repository;
use anyhow::Result;
use tracing::debug;

use crate::status::{FileStatus, RepoStatus};
use crate::diff::WorkspaceDiff;
use crate::history::CommitInfo;
use crate::branch::BranchInfo;

pub struct GitRepo {
    repo: Repository,
}

impl GitRepo {
    pub fn open(path: &str) -> Result<Self> {
        let repo = Repository::open(path)?;
        Ok(Self { repo })
    }

    pub fn status(&self) -> Result<RepoStatus> {
        let head   = self.repo.head()?;
        let branch = head.shorthand().unwrap_or("HEAD").to_string();

        let statuses = self.repo.statuses(None)?;
        let mut files = Vec::new();

        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("").to_string();
            let st = match entry.status() {
                s if s.is_wt_modified()  || s.is_index_modified()  => FileStatus::Modified,
                s if s.is_index_new()                               => FileStatus::Added,
                s if s.is_wt_deleted()   || s.is_index_deleted()   => FileStatus::Deleted,
                s if s.is_wt_renamed()   || s.is_index_renamed()   => FileStatus::Renamed,
                s if s.is_wt_new()                                  => FileStatus::Untracked,
                s if s.is_ignored()                                 => FileStatus::Ignored,
                s if s.is_conflicted()                              => FileStatus::Conflicted,
                _                                                   => continue,
            };
            files.push((path, st));
        }

        debug!("Git status: {} files on branch {}", files.len(), branch);
        Ok(RepoStatus { branch, ahead: 0, behind: 0, files })
    }

    pub fn diff(&self, file_path: Option<&str>) -> Result<WorkspaceDiff> {
        crate::diff::diff_index_to_workdir(&self.repo, file_path)
    }

    pub fn log(&self, max_count: usize, file_path: Option<&str>) -> Result<Vec<CommitInfo>> {
        crate::history::get_log(&self.repo, max_count, file_path)
    }

    pub fn branches(&self) -> Result<Vec<BranchInfo>> {
        crate::branch::list_branches(&self.repo)
    }
}
