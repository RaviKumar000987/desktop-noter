/// EventFilter — decides which file-system paths are worth indexing.
/// Applied before changes enter the ChangeQueue to keep the queue lean.

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build",
    ".next", "__pycache__", "vendor", ".cache", "coverage",
    ".turbo", ".vercel", ".svelte-kit", ".parcel-cache",
    ".yarn", ".pnp", "out", ".output",
];

/// Binary / generated file extensions that are never worth parsing.
const SKIP_EXTS: &[&str] = &[
    // Lockfiles
    "lock",
    // Source maps
    "map",
    // Images
    "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp",
    // Fonts
    "woff", "woff2", "ttf", "eot", "otf",
    // Media
    "mp4", "mp3", "wav", "ogg", "avi", "mov",
    // Archives
    "zip", "tar", "gz", "bz2", "xz", "7z", "rar",
    // Binaries
    "exe", "dll", "so", "dylib", "a", "lib",
    // Docs
    "pdf", "docx", "xlsx", "pptx",
    // DB files (managed by their own engines)
    "sqlite", "db",
];

pub struct EventFilter;

impl EventFilter {
    pub fn new() -> Self { Self }

    /// Returns true if a file change at this path should be enqueued.
    pub fn should_process(&self, path: &str) -> bool {
        let lower = path.to_lowercase().replace('\\', "/");

        // Skip excluded directories anywhere in the path
        if SKIP_DIRS.iter().any(|d| {
            lower.contains(&format!("/{}/", d))
                || lower.starts_with(&format!("{}/", d))
                || lower.ends_with(&format!("/{}", d))   // the dir itself was deleted
        }) {
            return false;
        }

        // Skip excluded extensions
        let ext = lower.rsplit('.').next().unwrap_or("");
        if SKIP_EXTS.contains(&ext) {
            return false;
        }

        // Skip hidden files (dotfiles) that aren't config files
        let filename = lower.rsplit('/').next().unwrap_or("");
        if filename.starts_with('.') && !is_config_dotfile(filename) {
            return false;
        }

        true
    }
}

fn is_config_dotfile(name: &str) -> bool {
    matches!(
        name,
        ".env" | ".env.local" | ".env.production" | ".env.development"
            | ".eslintrc" | ".eslintrc.json" | ".eslintrc.js"
            | ".prettierrc" | ".prettierrc.json" | ".prettierrc.js"
            | ".babelrc" | ".babelrc.json"
            | ".editorconfig" | ".nvmrc" | ".node-version"
            | ".gitignore" | ".npmignore" | ".dockerignore"
    )
}

impl Default for EventFilter {
    fn default() -> Self { Self::new() }
}
