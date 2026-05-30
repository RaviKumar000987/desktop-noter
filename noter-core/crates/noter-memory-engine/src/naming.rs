const CODE_EXTS: &[&str] = &["js","ts","jsx","tsx","py","go","rs","java","cs"];

pub fn detect_naming_convention(file_paths: &[String]) -> Option<String> {
    let mut camel  = 0u32;
    let mut pascal = 0u32;
    let mut snake  = 0u32;
    let mut kebab  = 0u32;

    for path in file_paths {
        let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
        if !CODE_EXTS.contains(&ext.as_str()) { continue; }

        // Get filename without extension
        let filename = path.replace('\\', "/");
        let filename = filename.rsplit('/').next().unwrap_or("");
        let name = filename.rsplit('.').skip(1).next().unwrap_or(filename);
        if name.len() < 3 { continue; }

        let first = name.chars().next().unwrap_or('x');

        if first.is_uppercase() && name.chars().any(|c| c.is_lowercase()) {
            pascal += 1;
        } else if name.contains('_') {
            snake += 1;
        } else if name.contains('-') {
            kebab += 1;
        } else if first.is_lowercase() && name.chars().any(|c| c.is_uppercase()) {
            camel += 1;
        }
    }

    let max = [camel, pascal, snake, kebab].iter().copied().max().unwrap_or(0);
    if max == 0 { return None; }

    Some(if max == pascal      { "PascalCase" }
         else if max == snake  { "snake_case" }
         else if max == kebab  { "kebab-case" }
         else                  { "camelCase"  }
         .to_string())
}
