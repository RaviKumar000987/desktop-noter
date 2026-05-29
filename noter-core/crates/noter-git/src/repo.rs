use git2::Repository;
use anyhow::Result;
use tracing::debug;

use crate::status::{FileStatus, RepoStatus};

pub struct GitRepo {
    repo: Repository,
}

impl GitRepo {
    pub fn open(path: &str) -> Result<Self> {
        let repo = Repository::open(path)?;
        Ok(Self { repo })
    }

    pub fn status(&self) -> Result<RepoStatus> {
        let head = self.repo.head()?;
        let branch = head.shorthand().unwrap_or("HEAD").to_string();

        let statuses = self.repo.statuses(None)?;
        let mut files = Vec::new();

        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("").to_string();
            let st = match entry.status() {
                s if s.is_wt_modified() || s.is_index_modified() => FileStatus::Modified,
                s if s.is_wt_new()      || s.is_index_new()      => FileStatus::Added,
                s if s.is_wt_deleted()  || s.is_index_deleted()  => FileStatus::Deleted,
                s if s.is_wt_renamed()  || s.is_index_renamed()  => FileStatus::Renamed,
                s if s.is_wt_new()                               => FileStatus::Untracked,
                s if s.is_ignored()                              => FileStatus::Ignored,
                s if s.is_conflicted()                           => FileStatus::Conflicted,
                _                                                => continue,
            };
            files.push((path, st));
        }

        debug!("Git status: {} on branch {}", files.len(), branch);
        Ok(RepoStatus { branch, ahead: 0, behind: 0, files })
    }
}
