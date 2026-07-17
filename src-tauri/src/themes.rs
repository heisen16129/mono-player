use crate::{api_response::ApiResponse, models::{ImportedTheme, SystemThemeState, ThemePackageManifest, WallpaperThemeColor}};
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::thread;
use std::time::Duration;

#[cfg(target_os = "windows")]
use tauri::{AppHandle, Emitter};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Registry::{
    RegCloseKey, RegGetValueW, RegNotifyChangeKeyValue, RegOpenKeyExW, HKEY_CURRENT_USER,
    KEY_NOTIFY, REG_NOTIFY_CHANGE_LAST_SET, RRF_RT_REG_DWORD,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETDESKWALLPAPER};

#[tauri::command]
pub(crate) async fn get_wallpaper_theme_color() -> ApiResponse<WallpaperThemeColor> {
    let result = tauri::async_runtime::spawn_blocking(current_wallpaper_theme_color)
        .await
        .map_err(|err| err.to_string())
        .and_then(|result| result);
    ApiResponse::from_result(result)
}

#[tauri::command]
pub(crate) async fn get_system_theme_state() -> ApiResponse<SystemThemeState> {
    let result = tauri::async_runtime::spawn_blocking(current_system_theme_payload)
        .await
        .map_err(|err| err.to_string());
    ApiResponse::from_result(result)
}

#[cfg(target_os = "windows")]
pub(crate) fn start_system_theme_watcher(app: AppHandle) {
    start_registry_theme_watcher(
        app.clone(),
        "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
    );
    start_registry_theme_watcher(app.clone(), "Control Panel\\Desktop");
    start_registry_theme_watcher(app, "Software\\Microsoft\\Windows\\CurrentVersion\\Themes");
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn start_system_theme_watcher(_app: tauri::AppHandle) {}

#[tauri::command]
pub(crate) fn import_theme_folder(path: String) -> ApiResponse<ImportedTheme> {
    ApiResponse::from_result(import_theme_folder_inner(path))
}

fn import_theme_folder_inner(path: String) -> Result<ImportedTheme, String> {
    let root = resolve_theme_package_root(PathBuf::from(path))?;

    let manifest_content = fs::read_to_string(root.join("theme.json"))
        .map_err(|_| "主题包缺少 theme.json。".to_string())?;
    let manifest: ThemePackageManifest = serde_json::from_str(&manifest_content)
        .map_err(|err| format!("theme.json 格式错误：{err}"))?;
    let theme_slug = normalize_theme_slug(&manifest.id)?;
    let entry = manifest
        .entry
        .unwrap_or_else(|| "variables.css".to_string());
    let variables_content = fs::read_to_string(root.join(entry))
        .map_err(|_| "主题包缺少 variables.css。".to_string())?;
    let variables = parse_theme_variables(&variables_content);

    if variables.is_empty() {
        return Err("variables.css 中没有可用的主题变量。".to_string());
    }

    let preview = resolve_theme_preview(&root, manifest.preview.as_deref());
    let background = resolve_theme_image(&root, manifest.background.as_deref());
    let background_opacity = normalize_theme_background_opacity(manifest.background_opacity)?;

    Ok(ImportedTheme {
        id: format!("custom:{theme_slug}"),
        name: manifest.name.trim().to_string(),
        author: manifest.author.unwrap_or_else(|| "Unknown".to_string()),
        variables,
        preview,
        background,
        background_opacity,
    })
}

#[cfg(target_os = "windows")]
fn current_system_theme_state() -> (bool, bool) {
    let apps_use_light_theme = read_personalize_dword("AppsUseLightTheme").unwrap_or(1) != 0;
    let system_uses_light_theme = read_personalize_dword("SystemUsesLightTheme").unwrap_or(1) != 0;
    (apps_use_light_theme, system_uses_light_theme)
}

#[cfg(not(target_os = "windows"))]
fn current_system_theme_state() -> (bool, bool) {
    (true, true)
}

fn current_system_theme_payload() -> SystemThemeState {
    let (apps_use_light_theme, system_uses_light_theme) = current_system_theme_state();

    SystemThemeState {
        mode: if apps_use_light_theme {
            "light"
        } else {
            "dark"
        }
        .to_string(),
        apps_use_light_theme,
        system_uses_light_theme,
        wallpaper_color: current_wallpaper_theme_color().ok(),
    }
}

#[cfg(target_os = "windows")]
fn start_registry_theme_watcher(app: AppHandle, subkey: &'static str) {
    thread::spawn(move || {
        let subkey = wide_null(subkey);
        let mut key = std::ptr::null_mut();
        let open_status =
            unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_NOTIFY, &mut key) };

        if open_status != 0 {
            return;
        }

        let mut last_state = current_system_theme_payload();

        loop {
            let notify_status = unsafe {
                RegNotifyChangeKeyValue(key, 0, REG_NOTIFY_CHANGE_LAST_SET, std::ptr::null_mut(), 0)
            };

            if notify_status != 0 {
                break;
            }

            thread::sleep(Duration::from_millis(180));
            let state = current_system_theme_payload();
            if state != last_state {
                last_state = state.clone();
                let _ = app.emit("system-theme-changed", state);
            }
        }

        unsafe {
            RegCloseKey(key);
        }
    });
}

fn current_wallpaper_theme_color() -> Result<WallpaperThemeColor, String> {
    let path = current_wallpaper_path()?;
    let (r, g, b) = dominant_image_color(&path)?;

    Ok(WallpaperThemeColor {
        r,
        g,
        b,
        path: Some(path.to_string_lossy().to_string()),
    })
}

#[cfg(target_os = "windows")]
fn read_personalize_dword(name: &str) -> Option<u32> {
    let subkey = wide_null("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
    let value_name = wide_null(name);
    let mut data = 0u32;
    let mut data_size = std::mem::size_of::<u32>() as u32;

    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            value_name.as_ptr(),
            RRF_RT_REG_DWORD,
            std::ptr::null_mut(),
            (&mut data as *mut u32).cast(),
            &mut data_size,
        )
    };

    if status == 0 {
        Some(data)
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn current_wallpaper_path() -> Result<PathBuf, String> {
    const MAX_PATH_LENGTH: usize = 32768;
    let mut buffer = [0u16; MAX_PATH_LENGTH];

    let ok = unsafe {
        SystemParametersInfoW(
            SPI_GETDESKWALLPAPER,
            MAX_PATH_LENGTH as u32,
            buffer.as_mut_ptr().cast(),
            0,
        )
    };

    if ok == 0 {
        return Err("Unable to read Windows wallpaper path.".to_string());
    }

    let length = buffer
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buffer.len());
    let wallpaper = String::from_utf16_lossy(&buffer[..length]);
    let wallpaper = wallpaper.trim();

    if !wallpaper.is_empty() {
        let path = PathBuf::from(wallpaper);
        if path.is_file() {
            return Ok(path);
        }
    }

    if let Some(app_data) = std::env::var_os("APPDATA") {
        let transcoded = PathBuf::from(app_data)
            .join("Microsoft")
            .join("Windows")
            .join("Themes")
            .join("TranscodedWallpaper");
        if transcoded.is_file() {
            return Ok(transcoded);
        }
    }

    Err("No readable desktop wallpaper file was found.".to_string())
}

#[cfg(not(target_os = "windows"))]
fn current_wallpaper_path() -> Result<PathBuf, String> {
    Err("Wallpaper color extraction is only available on Windows.".to_string())
}

fn dominant_image_color(path: &Path) -> Result<(u8, u8, u8), String> {
    let image = image::open(path).map_err(|err| err.to_string())?;
    let image = image
        .resize(128, 128, image::imageops::FilterType::Triangle)
        .to_rgba8();
    let mut bins: HashMap<(u8, u8, u8), (u64, u64, u64, u64)> = HashMap::new();
    let mut fallback = (0u64, 0u64, 0u64, 0u64);
    let mut soft_average = (0f64, 0f64, 0f64, 0f64);

    for pixel in image.pixels() {
        let [r, g, b, a] = pixel.0;
        if a < 128 {
            continue;
        }

        fallback.0 += u64::from(r);
        fallback.1 += u64::from(g);
        fallback.2 += u64::from(b);
        fallback.3 += 1;

        let brightness = (u16::from(r) + u16::from(g) + u16::from(b)) / 3;
        if !(34..=232).contains(&brightness) {
            continue;
        }

        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let saturation = f64::from(max - min) / 255.0;
        let balance = 1.0 - ((f64::from(brightness) - 150.0).abs() / 150.0).min(1.0);
        let muted_weight = (1.0 - saturation * 0.45).max(0.25) * (0.55 + balance * 0.45);
        soft_average.0 += f64::from(r) * muted_weight;
        soft_average.1 += f64::from(g) * muted_weight;
        soft_average.2 += f64::from(b) * muted_weight;
        soft_average.3 += muted_weight;

        let key = (r / 24, g / 24, b / 24);
        let entry = bins.entry(key).or_insert((0, 0, 0, 0));
        entry.0 += u64::from(r);
        entry.1 += u64::from(g);
        entry.2 += u64::from(b);
        entry.3 += 1;
    }

    let best = bins
        .values()
        .filter(|(_, _, _, count)| *count > 0)
        .max_by(|left, right| color_bin_score(left).total_cmp(&color_bin_score(right)))
        .copied()
        .or_else(|| (fallback.3 > 0).then_some(fallback))
        .ok_or_else(|| "Unable to sample wallpaper color.".to_string())?;

    let dominant = (
        best.0 as f64 / best.3 as f64,
        best.1 as f64 / best.3 as f64,
        best.2 as f64 / best.3 as f64,
    );
    let soft = if soft_average.3 > 0.0 {
        (
            soft_average.0 / soft_average.3,
            soft_average.1 / soft_average.3,
            soft_average.2 / soft_average.3,
        )
    } else {
        dominant
    };
    let blended = (
        dominant.0 * 0.32 + soft.0 * 0.68,
        dominant.1 * 0.32 + soft.1 * 0.68,
        dominant.2 * 0.32 + soft.2 * 0.68,
    );

    Ok(soften_theme_color(blended))
}

fn color_bin_score(bin: &(u64, u64, u64, u64)) -> f64 {
    let (r, g, b, count) = *bin;
    let r = r as f64 / count as f64;
    let g = g as f64 / count as f64;
    let b = b as f64 / count as f64;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let saturation = (max - min) / 255.0;
    let brightness = (r + g + b) / 3.0;
    let balanced_brightness = 1.0 - ((brightness - 132.0).abs() / 132.0).min(1.0);

    count as f64 * (1.0 + saturation * 0.35) * (0.85 + balanced_brightness * 0.45)
}

fn soften_theme_color(color: (f64, f64, f64)) -> (u8, u8, u8) {
    let warm_neutral = (236.0, 238.0, 222.0);
    let gray = (color.0 + color.1 + color.2) / 3.0;
    let saturation_scale = 0.58;
    let muted = (
        gray + (color.0 - gray) * saturation_scale,
        gray + (color.1 - gray) * saturation_scale,
        gray + (color.2 - gray) * saturation_scale,
    );
    let softened = (
        muted.0 * 0.72 + warm_neutral.0 * 0.28,
        muted.1 * 0.72 + warm_neutral.1 * 0.28,
        muted.2 * 0.72 + warm_neutral.2 * 0.28,
    );

    (
        softened.0.clamp(88.0, 188.0).round() as u8,
        softened.1.clamp(88.0, 188.0).round() as u8,
        softened.2.clamp(88.0, 188.0).round() as u8,
    )
}

fn normalize_theme_slug(id: &str) -> Result<String, String> {
    let slug = id.trim().to_ascii_lowercase();
    if slug.is_empty()
        || slug.len() > 48
        || !slug
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_')
    {
        return Err("主题 id 只能包含英文、数字、- 或 _。".to_string());
    }

    Ok(slug)
}

fn resolve_theme_package_root(path: PathBuf) -> Result<PathBuf, String> {
    if path.is_file() {
        if path.file_name().and_then(|value| value.to_str()) == Some("theme.json") {
            return path
                .parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| "无法识别主题包目录。".to_string());
        }

        return Err("请选择主题文件夹或 theme.json。".to_string());
    }

    if !path.is_dir() {
        return Err("主题目录不存在或不是文件夹。".to_string());
    }

    if path.join("theme.json").is_file() {
        return Ok(path);
    }

    let theme_roots = fs::read_dir(&path)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|child| child.is_dir() && child.join("theme.json").is_file())
        .collect::<Vec<_>>();

    match theme_roots.as_slice() {
        [theme_root] => Ok(theme_root.clone()),
        [] => Err("主题包缺少 theme.json。".to_string()),
        _ => Err("当前文件夹包含多个主题包，请选择其中一个主题文件夹。".to_string()),
    }
}

fn resolve_theme_preview(root: &Path, manifest_preview: Option<&str>) -> Option<String> {
    if let Some(path) = resolve_theme_image(root, manifest_preview) {
        return Some(path);
    }

    [
        "preview.png",
        "preview.jpg",
        "preview.jpeg",
        "preview.webp",
        "preview.svg",
    ]
    .iter()
    .map(|file_name| root.join(file_name))
    .find(|path| is_theme_preview_file(path))
    .map(|path| path.to_string_lossy().to_string())
}

fn resolve_theme_image(root: &Path, manifest_path: Option<&str>) -> Option<String> {
    let relative = Path::new(manifest_path?);
    if !relative.is_relative()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return None;
    }

    let path = root.join(relative);
    if !is_theme_preview_file(&path) {
        return None;
    }

    Some(path.to_string_lossy().to_string())
}

fn is_theme_preview_file(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| {
                matches!(
                    extension.to_ascii_lowercase().as_str(),
                    "png" | "jpg" | "jpeg" | "webp" | "svg"
                )
            })
            .unwrap_or(false)
}

fn parse_theme_variables(content: &str) -> HashMap<String, String> {
    let mut variables = HashMap::new();
    for declaration in content.split(';') {
        let Some((raw_name, raw_value)) = declaration.split_once(':') else {
            continue;
        };
        let Some(name_start) = raw_name.rfind("--smw-") else {
            continue;
        };

        let name = raw_name[name_start..].trim();
        let value = raw_value.trim();
        if is_allowed_theme_variable(name) && is_safe_theme_value(value) {
            variables.insert(name.to_string(), value.to_string());
        }
    }

    variables
}

fn normalize_theme_background_opacity(value: Option<f64>) -> Result<Option<f64>, String> {
    let Some(opacity) = value else {
        return Ok(None);
    };

    if !opacity.is_finite() || !(0.0..=1.0).contains(&opacity) {
        return Err("backgroundOpacity must be a number between 0 and 1.".to_string());
    }

    Ok(Some((opacity * 100.0).round() / 100.0))
}

fn is_allowed_theme_variable(name: &str) -> bool {
    matches!(
        name,
        "--smw-bg-canvas"
            | "--smw-bg-page"
            | "--smw-bg-sidebar"
            | "--smw-bg-panel"
            | "--smw-library-bg"
            | "--smw-library-border"
            | "--smw-bg-workspace"
            | "--smw-bg-input"
            | "--smw-bg-selected"
            | "--smw-bg-hover"
            | "--smw-border"
            | "--smw-border-soft"
            | "--smw-border-strong"
            | "--smw-window-border"
            | "--smw-player-bg"
            | "--smw-shell-bg"
            | "--smw-text-primary"
            | "--smw-text-body"
            | "--smw-text-secondary"
            | "--smw-text-muted"
            | "--smw-icon-muted"
            | "--smw-button-primary"
            | "--smw-scrollbar-thumb"
            | "--smw-scrollbar-thumb-hover"
            | "--smw-accent-blue"
            | "--smw-lyrics-bg"
            | "--smw-lyrics-glow-left"
            | "--smw-lyrics-glow-right"
            | "--smw-lyrics-current"
            | "--smw-volume-bg"
            | "--smw-volume-track"
            | "--smw-volume-fill"
            | "--smw-volume-thumb"
            | "--smw-volume-text"
            | "--smw-progress-track"
            | "--smw-progress-fill"
            | "--smw-progress-thumb"
            | "--smw-progress-thumb-border"
            | "--smw-progress-thumb-ring"
            | "--smw-cover-base"
            | "--smw-cover-base-deep"
            | "--smw-cover-line"
            | "--smw-cover-dot"
            | "--smw-cover-dot-soft"
            | "--smw-cover-object"
            | "--smw-cover-object-border"
            | "--smw-cover-divider"
            | "--smw-avatar-bg"
            | "--smw-avatar-bg-deep"
            | "--smw-avatar-fg"
            | "--smw-avatar-border"
            | "--smw-avatar-status-border"
            | "--smw-theme-bg-opacity"
            | "--smw-theme-bg-size"
            | "--smw-theme-bg-position"
            | "--smw-theme-bg-repeat"
    )
}

fn is_safe_theme_value(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    !value.is_empty()
        && value.len() <= 160
        && !value.contains('{')
        && !value.contains('}')
        && !value.contains(';')
        && !lower.contains("url(")
        && !lower.contains("@import")
}
