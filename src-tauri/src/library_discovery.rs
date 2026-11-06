use std::{collections::HashSet, fs, path::{Path, PathBuf}};

fn is_link(path: &Path) -> bool {
    let Ok(metadata) = fs::symlink_metadata(path) else { return true; };
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 { return true; }
    }
    metadata.file_type().is_symlink()
}

/// Discover only personal projects below the active library's projects folder.
/// Never follow junctions, symlinks, or project manifests outside that boundary.
pub fn personal_project_dirs(library: &Path) -> Result<Vec<PathBuf>, String> {
    let root = library.join("projects");
    if !root.exists() || is_link(&root) { return Ok(Vec::new()); }
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let mut found = Vec::new();
    let mut visited = HashSet::new();
    scan(&root, &root, &mut visited, &mut found)?;
    Ok(found)
}

fn scan(root: &Path, directory: &Path, visited: &mut HashSet<PathBuf>, found: &mut Vec<PathBuf>) -> Result<(), String> {
    if is_link(directory) { return Ok(()); }
    let resolved = directory.canonicalize().map_err(|error| error.to_string())?;
    if !resolved.starts_with(root) || !visited.insert(resolved.clone()) { return Ok(()); }
    let name = directory.file_name().and_then(|name| name.to_str()).unwrap_or("");
    if name.starts_with(".paideia-") { return Ok(()); }
    let manifest = directory.join("project.json");
    let content = directory.join("content");
    let course = content.join("course.json");
    if manifest.is_file() && course.is_file() {
        if !is_link(&manifest) && !is_link(&content) && !is_link(&course)
            && manifest.canonicalize().is_ok_and(|path| path.starts_with(root))
            && course.canonicalize().is_ok_and(|path| path.starts_with(root)) {
            found.push(resolved);
        }
        return Ok(());
    }
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry.file_type().map_err(|error| error.to_string())?.is_dir() && !is_link(&entry.path()) {
            scan(root, &entry.path(), visited, found)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn confines_discovery_and_excludes_moved_projects() {
        let root = std::env::temp_dir().join(format!("paideia-discovery-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let project = root.join("projects/group/lesson");
        fs::create_dir_all(project.join("content")).unwrap();
        fs::write(project.join("project.json"), "{}").unwrap();
        fs::write(project.join("content/course.json"), "{}").unwrap();
        assert_eq!(personal_project_dirs(&root).unwrap(), vec![project.canonicalize().unwrap()]);
        fs::rename(&project, root.join("moved-lesson")).unwrap();
        assert!(personal_project_dirs(&root).unwrap().is_empty());
        #[cfg(windows)]
        {
            let junction = root.join("projects/redirect");
            let status = std::process::Command::new("cmd").args(["/C", "mklink", "/J"])
                .arg(junction.to_string_lossy().replace('/', "\\")).arg(root.join("moved-lesson").to_string_lossy().replace('/', "\\")).output().unwrap();
            assert!(status.status.success(), "{} {}", String::from_utf8_lossy(&status.stdout), String::from_utf8_lossy(&status.stderr));
            assert!(personal_project_dirs(&root).unwrap().is_empty());
            fs::remove_dir(&junction).unwrap();
        }
        fs::remove_dir_all(&root).unwrap();
    }
}
