use napi_derive::napi;
use napi::bindgen_prelude::*;
use noter_git::GitRepo;

#[napi(object)]
pub struct JsFileStatus {
    pub path: String,
    pub status: String,
}

#[napi(object)]
pub struct JsRepoStatus {
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<JsFileStatus>,
}

/// Get current git status for `repo_path`.
#[napi]
pub fn git_status(repo_path: String) -> Result<JsRepoStatus> {
    let repo = GitRepo::open(&repo_path)
        .map_err(|e| Error::from_reason(e.to_string()))?;

    let status = repo.status()
        .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(JsRepoStatus {
        branch: status.branch,
        ahead: status.ahead as u32,
        behind: status.behind as u32,
        files: status
            .files
            .into_iter()
            .map(|(path, st)| JsFileStatus {
                path,
                status: format!("{:?}", st),
            })
            .collect(),
    })
}
