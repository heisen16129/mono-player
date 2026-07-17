use crate::{
    api_response::ApiResponse,
    models::{LyricLine, LyricWord, Track, TrackLyrics},
};
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LyricsResolveInfo {
    pub(crate) raw_lyrics: Option<String>,
    pub(crate) source_url: Option<String>,
    pub(crate) local_path: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) format: Option<String>,
}

#[tauri::command]
pub(crate) fn resolve_lyrics_source(lyrics: LyricsResolveInfo) -> ApiResponse<Vec<LyricLine>> {
    ApiResponse::from_result(resolve_lyrics_source_backend(&lyrics))
}

#[tauri::command]
pub(crate) fn resolve_local_track_lyrics(
    track: Track,
    format: Option<String>,
) -> ApiResponse<Option<TrackLyrics>> {
    eprintln!(
        "[local-lyrics] request path={} title={} artist={} format={}",
        track.path,
        track.title,
        track.artist.as_deref().unwrap_or(""),
        format.as_deref().unwrap_or("")
    );
    let result = read_local_lyrics_bundle_for_track(
        &track.path,
        Some(&track.title),
        track.artist.as_deref(),
        format.as_deref(),
    );
    match &result {
        Ok(Some(lyrics)) => eprintln!(
            "[local-lyrics] response hasLyrics=true url={} formats={:?} format={} defaultFormat={} rawLength={}",
            lyrics.lyrics_url.as_deref().unwrap_or(""),
            lyrics.formats,
            lyrics.format.as_deref().unwrap_or(""),
            lyrics.default_format.as_deref().unwrap_or(""),
            lyrics.raw_lyrics.as_deref().map(str::len).unwrap_or(0)
        ),
        Ok(None) => eprintln!("[local-lyrics] response hasLyrics=false"),
        Err(error) => eprintln!("[local-lyrics] response error={error}"),
    }
    ApiResponse::from_result(result)
}

pub(crate) fn parse_lyrics_content_with_format(
    content: &str,
    format: Option<&str>,
) -> Vec<LyricLine> {
    parse_lyrics(
        &normalize_lyrics_content(content),
        normalize_lyrics_format(format),
    )
}

pub(crate) fn extract_raw_lyrics_text(content: &str) -> Option<String> {
    let normalized = normalize_lyrics_content(content);
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

pub(crate) fn resolve_lyrics_source_backend(
    lyrics: &LyricsResolveInfo,
) -> Result<Vec<LyricLine>, String> {
    if let Some(raw_lyrics) = lyrics
        .raw_lyrics
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(parse_lyrics_content_with_format(
            raw_lyrics,
            lyrics.format.as_deref(),
        ));
    }

    if let Some(source_url) = lyrics
        .source_url
        .as_deref()
        .map(str::trim)
        .filter(|value| is_http_url(value))
    {
        return fetch_lyrics_url_text(source_url)
            .map(|content| parse_lyrics_content_with_format(&content, lyrics.format.as_deref()));
    }

    let Some(local_path) = lyrics
        .local_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && !is_http_url(value))
    else {
        return Ok(Vec::new());
    };

    read_local_lyrics_for_track(
        local_path.to_string(),
        lyrics.title.as_deref(),
        lyrics.artist.as_deref(),
        lyrics.format.as_deref(),
    )
}

pub(crate) fn fetch_lyrics_url_text(url: &str) -> Result<String, String> {
    if !is_http_url(url) {
        return Err("lyrics url must start with http:// or https://".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")
        .build()
        .map_err(|err| err.to_string())?;
    let response = client.get(url).send().map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("lyrics url returned HTTP {}", status.as_u16()));
    }

    let body = response.text().map_err(|err| err.to_string())?;
    extract_raw_lyrics_text(&body)
        .filter(|lyrics| !lyrics.trim().is_empty())
        .ok_or_else(|| "lyrics url did not contain readable lyrics.".to_string())
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn read_local_lyrics_for_track(
    path: String,
    title: Option<&str>,
    artist: Option<&str>,
    format: Option<&str>,
) -> Result<Vec<LyricLine>, String> {
    let audio_path = PathBuf::from(path);
    let Some(stem) = audio_path.file_stem().and_then(|value| value.to_str()) else {
        return Ok(Vec::new());
    };

    let Some(parent) = audio_path.parent() else {
        return Ok(Vec::new());
    };

    if let Some(lyric_path) = find_lyric_file(parent, stem, title, artist) {
        let content = fs::read_to_string(&lyric_path).map_err(|err| err.to_string())?;
        return Ok(parse_lyrics_content_with_format(&content, format));
    }

    Ok(Vec::new())
}

pub(crate) fn read_local_lyrics_bundle_for_track(
    path: &str,
    title: Option<&str>,
    artist: Option<&str>,
    preferred_format: Option<&str>,
) -> Result<Option<TrackLyrics>, String> {
    let audio_path = PathBuf::from(path);
    let Some(stem) = audio_path.file_stem().and_then(|value| value.to_str()) else {
        return Ok(None);
    };

    let Some(parent) = audio_path.parent() else {
        return Ok(None);
    };

    let lyric_files = find_lyric_files(parent, stem, title, artist);
    if lyric_files.is_empty() {
        return Ok(None);
    }

    let formats = lyric_files
        .iter()
        .map(|(format, _path)| format.clone())
        .collect::<Vec<_>>();
    let preferred_format = normalize_lyrics_format(preferred_format);
    let format = preferred_format
        .filter(|format| formats.iter().any(|item| item == format))
        .unwrap_or_else(|| formats[0].as_str())
        .to_string();
    let lyrics_path = lyric_files
        .iter()
        .find(|(item_format, _path)| item_format == &format)
        .map(|(_format, path)| path)
        .unwrap_or(&lyric_files[0].1);
    let raw_lyrics = fs::read_to_string(lyrics_path).map_err(|err| err.to_string())?;

    Ok(Some(TrackLyrics {
        raw_lyrics: Some(raw_lyrics),
        lyrics_url: Some(lyrics_path.to_string_lossy().to_string()),
        formats,
        default_format: Some(lyric_files[0].0.clone()),
        format: Some(format),
        provider_id: None,
        provider_name: None,
        track_id: None,
        track_raw: None,
    }))
}

fn find_lyric_file(
    parent: &Path,
    stem: &str,
    title: Option<&str>,
    artist: Option<&str>,
) -> Option<PathBuf> {
    let exact_stems = lyric_exact_stems(stem, title, artist);
    for exact_stem in &exact_stems {
        if let Some(path) = find_exact_lyric_file(parent, exact_stem) {
            return Some(path);
        }
    }

    let targets = exact_stems
        .iter()
        .map(|value| normalize_lyric_name(value))
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    fs::read_dir(parent)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            let extension_matches = path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| {
                    matches!(
                        extension.to_ascii_lowercase().as_str(),
                        "lrc" | "txt" | "yrc" | "qrc" | "krc"
                    )
                })
                .unwrap_or(false);

            if !path.is_file() || !extension_matches {
                return false;
            }

            let candidate = path
                .file_stem()
                .and_then(|value| value.to_str())
                .map(normalize_lyric_name)
                .unwrap_or_default();

            !candidate.is_empty()
                && targets
                    .iter()
                    .any(|target| candidate.contains(target) || target.contains(&candidate))
        })
}

fn find_lyric_files(
    parent: &Path,
    stem: &str,
    title: Option<&str>,
    artist: Option<&str>,
) -> Vec<(String, PathBuf)> {
    let exact_stems = lyric_exact_stems(stem, title, artist);
    let mut files = Vec::new();
    for exact_stem in &exact_stems {
        push_exact_lyric_files(parent, exact_stem, &mut files);
        if !files.is_empty() {
            return files;
        }
    }

    let targets = exact_stems
        .iter()
        .map(|value| normalize_lyric_name(value))
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    if targets.is_empty() {
        return files;
    }

    let Ok(entries) = fs::read_dir(parent) else {
        return files;
    };
    for path in entries.filter_map(Result::ok).map(|entry| entry.path()) {
        if !path.is_file() {
            continue;
        }
        let Some(format) = lyric_file_format(&path) else {
            continue;
        };
        let candidate = path
            .file_stem()
            .and_then(|value| value.to_str())
            .map(normalize_lyric_name)
            .unwrap_or_default();
        if candidate.is_empty()
            || !targets
                .iter()
                .any(|target| candidate.contains(target) || target.contains(&candidate))
        {
            continue;
        }
        push_unique_lyric_file(&mut files, format, path);
    }
    sort_lyric_files(&mut files);
    files
}

fn find_exact_lyric_file(parent: &Path, stem: &str) -> Option<PathBuf> {
    for extension in ["yrc", "qrc", "krc", "lrc", "txt"] {
        let lyric_path = parent.join(format!("{stem}.{extension}"));
        if lyric_path.is_file() {
            return Some(lyric_path);
        }
    }
    None
}

fn push_exact_lyric_files(parent: &Path, stem: &str, files: &mut Vec<(String, PathBuf)>) {
    for extension in ["yrc", "qrc", "krc", "lrc", "txt"] {
        let lyric_path = parent.join(format!("{stem}.{extension}"));
        if lyric_path.is_file() {
            push_unique_lyric_file(files, extension.to_string(), lyric_path);
        }
    }
}

fn lyric_file_format(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    matches!(extension.as_str(), "yrc" | "qrc" | "krc" | "lrc" | "txt").then_some(extension)
}

fn push_unique_lyric_file(files: &mut Vec<(String, PathBuf)>, format: String, path: PathBuf) {
    if files.iter().any(|(_, item_path)| item_path == &path) {
        return;
    }
    files.push((format, path));
}

fn sort_lyric_files(files: &mut [(String, PathBuf)]) {
    files.sort_by_key(|(format, _path)| match format.as_str() {
        "yrc" => 0,
        "qrc" => 1,
        "krc" => 2,
        "lrc" => 3,
        "txt" => 4,
        _ => 5,
    });
}

fn lyric_exact_stems(stem: &str, title: Option<&str>, artist: Option<&str>) -> Vec<String> {
    let mut stems = Vec::new();
    if let Some(title) = title.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some(artist) = artist.map(str::trim).filter(|value| !value.is_empty()) {
            let title_with_artist = if title.ends_with(&format!(" - {artist}")) {
                title.to_string()
            } else {
                format!("{title} - {artist}")
            };
            push_unique_stem(&mut stems, sanitize_lyric_file_stem(&title_with_artist));
        }
        push_unique_stem(&mut stems, sanitize_lyric_file_stem(title));
    }
    push_unique_stem(&mut stems, sanitize_lyric_file_stem(stem));
    stems
}

fn push_unique_stem(stems: &mut Vec<String>, stem: String) {
    if !stem.is_empty() && !stems.iter().any(|value| value == &stem) {
        stems.push(stem);
    }
}

fn sanitize_lyric_file_stem(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string()
}

fn normalize_lyric_name(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn normalize_lyrics_content(content: &str) -> String {
    let content = extract_html_element_by_id(content, "lyrics").unwrap_or(content);
    let text = decode_html_entities(&strip_html_tags(content))
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    normalize_lrc_lines(&text)
}

fn extract_html_element_by_id<'a>(html: &'a str, id: &str) -> Option<&'a str> {
    let marker = format!("id=\"{id}\"");
    let marker_index = html.find(&marker)?;
    let relative_start = html[marker_index..].find('>')?;
    let content_start = marker_index + relative_start + 1;
    let content_end = html[content_start..]
        .find("</div>")
        .map(|index| content_start + index)
        .unwrap_or_else(|| html.len());
    Some(&html[content_start..content_end])
}

fn normalize_lrc_lines(raw_lyrics: &str) -> String {
    let mut output = Vec::new();
    let mut pending_time: Option<String> = None;

    for line in raw_lyrics
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        if is_time_only_line(line) {
            pending_time = Some(line.to_string());
            continue;
        }

        if let Some(time) = pending_time.take() {
            output.push(format!("{time}{line}"));
        } else {
            output.push(line.to_string());
        }
    }

    if let Some(time) = pending_time {
        output.push(time);
    }

    output.join("\n")
}

fn is_time_only_line(line: &str) -> bool {
    let Some(rest) = line.strip_prefix('[') else {
        return false;
    };
    let Some(time) = rest.strip_suffix(']') else {
        return false;
    };
    let Some((minutes, seconds)) = time.split_once(':') else {
        return false;
    };
    !minutes.is_empty()
        && !seconds.is_empty()
        && minutes.chars().all(|character| character.is_ascii_digit())
        && seconds
            .chars()
            .all(|character| character.is_ascii_digit() || character == '.' || character == ':')
}

fn strip_html_tags(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut in_tag = false;
    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }
    output
}

fn decode_html_entities(value: &str) -> String {
    value
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#039;", "'")
}

fn parse_lyrics(content: &str, format: Option<&str>) -> Vec<LyricLine> {
    let mut lines = content
        .lines()
        .flat_map(|line| {
            if let Some(line) = parse_timed_lyric_line(line, format) {
                return vec![line];
            }

            let mut text = line.trim();
            let mut times = Vec::new();

            while let Some(rest) = text.strip_prefix('[') {
                let Some(close_index) = rest.find(']') else {
                    break;
                };
                let tag = &rest[..close_index];
                if let Some(time) = parse_lyric_time(tag) {
                    times.push(time);
                }
                text = rest[close_index + 1..].trim_start();
            }

            let timed_words = parse_timed_words(text, times.first().copied());
            let text = timed_words
                .as_ref()
                .map(|words| {
                    words
                        .iter()
                        .map(|word| word.text.as_str())
                        .collect::<String>()
                        .trim()
                        .to_string()
                })
                .unwrap_or_else(|| strip_inline_lyric_times(text));

            if text.is_empty() {
                return Vec::new();
            }

            if times.is_empty() {
                return vec![LyricLine {
                    time: None,
                    text,
                    words: None,
                }];
            }

            if let Some(words) = timed_words {
                if words.len() > 1 {
                    return vec![LyricLine {
                        time: words.first().map(|word| word.time),
                        text,
                        words: Some(words),
                    }];
                }
            }

            times
                .into_iter()
                .map(|time| LyricLine {
                    time: Some(time),
                    text: text.clone(),
                    words: None,
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();

    lines.sort_by(|left, right| match (left.time, right.time) {
        (Some(left_time), Some(right_time)) => left_time.total_cmp(&right_time),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    lines
}

fn parse_timed_lyric_line(line: &str, format: Option<&str>) -> Option<LyricLine> {
    match format {
        Some("yrc") => {
            parse_yrc_lyric_line(line).or_else(|| parse_yrc_prefix_word_lyric_line(line))
        }
        Some("qrc") => parse_qrc_lyric_line(line),
        Some("krc") => parse_krc_lyric_line(line),
        Some("a2") => parse_a2_lyric_line(line),
        _ => parse_a2_lyric_line(line)
            .or_else(|| parse_yrc_lyric_line(line))
            .or_else(|| parse_qrc_lyric_line(line))
            .or_else(|| parse_krc_lyric_line(line)),
    }
}

fn normalize_lyrics_format(format: Option<&str>) -> Option<&'static str> {
    match format?.trim().to_ascii_lowercase().as_str() {
        "yrc" => Some("yrc"),
        "qrc" => Some("qrc"),
        "krc" => Some("krc"),
        "a2" => Some("a2"),
        "lrc" => Some("lrc"),
        "txt" => Some("txt"),
        "trans" => Some("trans"),
        _ => None,
    }
}

fn parse_a2_lyric_line(line: &str) -> Option<LyricLine> {
    let mut rest = line;
    let mut line_time = None;
    let mut words = Vec::new();

    while let Some(open_index) = rest.find('[') {
        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find(']') else {
            break;
        };
        if let Some(time) = parse_lyric_time(&after_open[..close_index]) {
            line_time = Some(time);
            break;
        }
        rest = after_open;
    }

    rest = line;
    while let Some(open_index) = rest.find('<') {
        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find('>') else {
            break;
        };
        let tag = &after_open[..close_index];
        let Some(time) = parse_lyric_time(tag) else {
            rest = after_open;
            continue;
        };
        let after_tag = &after_open[close_index + 1..];
        let next_open = after_tag.find('<').unwrap_or(after_tag.len());
        let word_text = &after_tag[..next_open];
        if !word_text.trim().is_empty() {
            words.push(LyricWord {
                time,
                text: word_text.to_string(),
            });
        }
        rest = &after_tag[next_open..];
    }

    build_timed_line(
        line_time.or_else(|| words.first().map(|word| word.time)),
        words,
    )
}

fn parse_qrc_lyric_line(line: &str) -> Option<LyricLine> {
    let (line_start, text) = parse_millisecond_line_prefix(line)?;
    let mut rest = text;
    let mut words = Vec::new();

    while let Some(open_index) = rest.find('(') {
        let word_text = &rest[..open_index];
        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find(')') else {
            break;
        };
        let tag = &after_open[..close_index];
        if let Some((offset, _duration)) = parse_millisecond_pair(tag) {
            if !word_text.trim().is_empty() {
                words.push(LyricWord {
                    time: line_start + offset / 1000.0,
                    text: word_text.to_string(),
                });
            }
        }
        rest = &after_open[close_index + 1..];
    }

    build_timed_line(Some(line_start), words)
}

fn parse_yrc_prefix_word_lyric_line(line: &str) -> Option<LyricLine> {
    let (line_start, mut rest) = parse_millisecond_line_prefix(line)?;
    let mut words = Vec::new();

    while let Some(open_index) = rest.find('(') {
        let word_text = &rest[..open_index];
        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find(')') else {
            break;
        };
        let tag = &after_open[..close_index];
        if let Some((start, _duration)) = parse_millisecond_pair(tag) {
            if !word_text.trim().is_empty() {
                words.push(LyricWord {
                    time: start / 1000.0,
                    text: word_text.to_string(),
                });
            }
        }
        rest = &after_open[close_index + 1..];
    }

    build_timed_line(Some(line_start), words)
}

fn parse_yrc_lyric_line(line: &str) -> Option<LyricLine> {
    let (line_start, mut rest) = parse_millisecond_line_prefix(line)?;
    let mut words = Vec::new();

    while let Some(open_index) = rest.find('(') {
        if !rest[..open_index].trim().is_empty() {
            return None;
        }

        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find(')') else {
            break;
        };
        let tag = &after_open[..close_index];
        let Some((start, _duration)) = parse_millisecond_pair(tag) else {
            rest = after_open;
            continue;
        };
        let after_tag = &after_open[close_index + 1..];
        let next_open = after_tag.find('(').unwrap_or(after_tag.len());
        let word_text = &after_tag[..next_open];
        if !word_text.trim().is_empty() {
            words.push(LyricWord {
                time: start / 1000.0,
                text: word_text.to_string(),
            });
        }
        rest = &after_tag[next_open..];
    }

    build_timed_line(Some(line_start), words)
}

fn parse_krc_lyric_line(line: &str) -> Option<LyricLine> {
    let (line_start, mut rest) = parse_millisecond_line_prefix(line)?;
    let mut words = Vec::new();

    while let Some(open_index) = rest.find('<') {
        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find('>') else {
            break;
        };
        let tag = &after_open[..close_index];
        let Some((offset, _duration)) = parse_millisecond_pair(tag) else {
            rest = after_open;
            continue;
        };
        let after_tag = &after_open[close_index + 1..];
        let next_open = after_tag.find('<').unwrap_or(after_tag.len());
        let word_text = &after_tag[..next_open];
        if !word_text.trim().is_empty() {
            words.push(LyricWord {
                time: line_start + offset / 1000.0,
                text: word_text.to_string(),
            });
        }
        rest = &after_tag[next_open..];
    }

    build_timed_line(Some(line_start), words)
}

fn build_timed_line(time: Option<f64>, words: Vec<LyricWord>) -> Option<LyricLine> {
    if words.len() <= 1 {
        return None;
    }

    let text = words
        .iter()
        .map(|word| word.text.as_str())
        .collect::<String>()
        .trim()
        .to_string();

    if text.is_empty() {
        return None;
    }

    Some(LyricLine {
        time,
        text,
        words: Some(words),
    })
}

fn parse_millisecond_line_prefix(line: &str) -> Option<(f64, &str)> {
    let line = line.trim();
    let rest = line.strip_prefix('[')?;
    let close_index = rest.find(']')?;
    let tag = &rest[..close_index];
    let (start, _duration) = parse_millisecond_pair(tag)?;
    Some((start / 1000.0, &rest[close_index + 1..]))
}

fn parse_millisecond_pair(tag: &str) -> Option<(f64, f64)> {
    let mut parts = tag.split(',');
    let start = parts.next()?.trim().parse::<f64>().ok()?;
    let duration = parts.next()?.trim().parse::<f64>().ok()?;
    Some((start, duration))
}

fn parse_timed_words(text: &str, first_time: Option<f64>) -> Option<Vec<LyricWord>> {
    let mut words = Vec::new();
    let mut rest = text;

    while let Some(open_index) = rest.find('[') {
        if words.is_empty() && open_index > 0 {
            if let Some(time) = first_time {
                let leading_text = &rest[..open_index];
                if !leading_text.trim().is_empty() {
                    words.push(LyricWord {
                        time,
                        text: leading_text.to_string(),
                    });
                }
            }
        }

        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find(']') else {
            break;
        };

        let tag = &after_open[..close_index];
        let Some(time) = parse_lyric_time(tag) else {
            rest = after_open;
            continue;
        };

        let word_start = close_index + 1;
        let after_tag = &after_open[word_start..];
        let next_open = after_tag.find('[').unwrap_or(after_tag.len());
        let word_text = &after_tag[..next_open];
        if !word_text.trim().is_empty() {
            words.push(LyricWord {
                time,
                text: word_text.to_string(),
            });
        }
        rest = &after_tag[next_open..];
    }

    if words.len() > 1 {
        Some(words)
    } else {
        None
    }
}

fn strip_inline_lyric_times(text: &str) -> String {
    let mut cleaned = String::with_capacity(text.len());
    let mut rest = text;

    loop {
        let Some(open_index) = rest.find('[') else {
            cleaned.push_str(rest);
            break;
        };

        cleaned.push_str(&rest[..open_index]);
        let after_open = &rest[open_index + 1..];
        let Some(close_index) = after_open.find(']') else {
            cleaned.push_str(&rest[open_index..]);
            break;
        };

        let tag = &after_open[..close_index];
        if parse_lyric_time(tag).is_some() {
            rest = &after_open[close_index + 1..];
        } else {
            cleaned.push('[');
            rest = after_open;
        }
    }

    cleaned.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::parse_lyrics_content_with_format;

    #[test]
    fn parses_yrc_word_timing() {
        let lines =
            parse_lyrics_content_with_format("[1000,2000](1000,300,0)你(1300,300,0)好", None);

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].time, Some(1.0));
        assert_eq!(lines[0].text, "你好");

        let words = lines[0].words.as_ref().expect("expected timed words");
        assert_eq!(words.len(), 2);
        assert_eq!(words[0].time, 1.0);
        assert_eq!(words[0].text, "你");
        assert_eq!(words[1].time, 1.3);
        assert_eq!(words[1].text, "好");
    }

    #[test]
    fn keeps_first_word_for_qrc_style_timing() {
        let lines = parse_lyrics_content_with_format("[1000,2000]参(0,300,0)与(300,300,0)任", None);

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].time, Some(1.0));
        assert_eq!(lines[0].text, "参与");

        let words = lines[0].words.as_ref().expect("expected timed words");
        assert_eq!(words.len(), 2);
        assert_eq!(words[0].time, 1.0);
        assert_eq!(words[0].text, "参");
        assert_eq!(words[1].time, 1.3);
        assert_eq!(words[1].text, "与");
    }

    #[test]
    fn parses_yrc_format_with_qrc_style_words() {
        let lines =
            parse_lyrics_content_with_format("[1000,2000]参(0,300,0)与(300,300,0)任", Some("yrc"));

        let words = lines[0].words.as_ref().expect("expected timed words");
        assert_eq!(lines[0].text, "参与");
        assert_eq!(words[0].text, "参");
    }

    #[test]
    fn parses_yrc_prefix_words_as_absolute_timing() {
        let lines = parse_lyrics_content_with_format(
            "[45000,2000]A(45000,300,0)B(45300,300,0)",
            Some("yrc"),
        );

        let words = lines[0].words.as_ref().expect("expected timed words");
        assert_eq!(lines[0].time, Some(45.0));
        assert_eq!(lines[0].text, "AB");
        assert_eq!(words[0].time, 45.0);
        assert_eq!(words[0].text, "A");
        assert_eq!(words[1].time, 45.3);
        assert_eq!(words[1].text, "B");
    }
}

fn parse_lyric_time(value: &str) -> Option<f64> {
    let (minutes, seconds) = value.split_once(':')?;
    let minutes = minutes.parse::<f64>().ok()?;
    let seconds = seconds.parse::<f64>().ok()?;
    Some(minutes * 60.0 + seconds)
}
