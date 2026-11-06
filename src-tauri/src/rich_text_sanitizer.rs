use crate::models::PaideiaProject;
use ammonia::{Builder, UrlRelative};
use regex::Regex;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::{atomic::{AtomicU64, Ordering}, OnceLock};

const RICH_HTML_KEYS: &[&str] = &[
    "afterHtml", "cardFeedbackCorrectHtml", "cardFeedbackHtml",
    "cardFeedbackIncorrectHtml", "contentHtml", "correctionHtml",
    "courseCoverTitleHtml", "courseIntroHtml", "descriptionHtml",
    "failureFeedbackHtml", "failureHtml", "feedbackCorrectHtml", "feedbackHtml",
    "feedbackIncorrectHtml", "generalFeedbackHtml", "introHtml", "labelHtml",
    "leftHtml", "questionHtml", "quoteAuthorHtml", "rightHtml", "riskHtml",
    "startLeadHtml", "successFeedbackHtml", "successHtml", "textHtml", "titleHtml",
    "transcriptHtml", "definitionHtml",
];

fn set(values: &[&'static str]) -> HashSet<&'static str> {
    values.iter().copied().collect()
}

fn rich_text_builder() -> Builder<'static> {
    let mut attributes = HashMap::new();
    attributes.insert("a", set(&["href", "target", "rel", "title"]));
    attributes.insert("img", set(&["src", "alt", "width", "height", "title"]));
    attributes.insert("ol", set(&["start", "type", "reversed"]));
    attributes.insert("li", set(&["value"]));
    attributes.insert("col", set(&["span", "width"]));
    attributes.insert("colgroup", set(&["span", "width"]));
    attributes.insert("td", set(&["colspan", "rowspan", "headers"]));
    attributes.insert("th", set(&["colspan", "rowspan", "headers", "scope"]));
    attributes.insert("font", set(&["color", "face", "size"]));

    let allowed_styles = set(&[
        "-webkit-text-stroke",
        "-webkit-text-stroke-color",
        "-webkit-text-stroke-width",
        "--paideia-rich-outline-color",
        "--paideia-table-border-color",
        "--paideia-table-custom-width",
        "--paideia-table-custom-offset",
        "--paideia-table-border-width",
        "--paideia-line-leading-base",
        "--paideia-line-leading-effective",
        "--paideia-line-leading-rendered",
        "--paideia-line-leading-responsive-rendered",
        "--paideia-line-leading-offset",
        "--paideia-line-leading-responsive-offset",
        "--paideia-list-marker-color",
        "--paideia-list-marker-size",
        "--paideia-list-marker-weight",
        "background",
        "background-color",
        "border",
        "border-bottom",
        "border-bottom-color",
        "border-bottom-style",
        "border-bottom-width",
        "border-collapse",
        "border-color",
        "border-left",
        "border-left-color",
        "border-left-style",
        "border-left-width",
        "border-radius",
        "border-right",
        "border-right-color",
        "border-right-style",
        "border-right-width",
        "border-style",
        "border-top",
        "border-top-color",
        "border-top-style",
        "border-top-width",
        "border-width",
        "color",
        "font-family",
        "font-size",
        "font-style",
        "font-weight",
        "height",
        "line-height",
        "margin",
        "margin-block",
        "margin-block-end",
        "margin-block-start",
        "margin-bottom",
        "margin-inline-start",
        "margin-left",
        "margin-right",
        "margin-top",
        "opacity",
        "padding",
        "padding-bottom",
        "padding-left",
        "padding-right",
        "padding-top",
        "paint-order",
        "text-align",
        "text-decoration",
        "text-decoration-color",
        "text-decoration-line",
        "text-decoration-style",
        "vertical-align",
        "width",
    ]);

    let mut builder = Builder::default();
    builder
        .tags(set(&[
            "a",
            "b",
            "blockquote",
            "br",
            "caption",
            "center",
            "code",
            "col",
            "colgroup",
            "div",
            "em",
            "font",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "hr",
            "i",
            "img",
            "li",
            "mark",
            "ol",
            "p",
            "pre",
            "s",
            "span",
            "strike",
            "strong",
            "sub",
            "sup",
            "table",
            "tbody",
            "td",
            "tfoot",
            "th",
            "thead",
            "tr",
            "u",
            "ul",
        ]))
        .tag_attributes(attributes)
        .generic_attributes(set(&[
            "class",
            "contenteditable",
            "dir",
            "lang",
            "role",
            "style",
            "tabindex",
            "title",
            "data-rich-original-text",
        ]))
        .generic_attribute_prefixes(set(&["aria-", "data-paideia-"]))
        .link_rel(None)
        .url_schemes(set(&["http", "https", "data"]))
        .url_relative(UrlRelative::PassThrough)
        .clean_content_tags(set(&[
            "applet", "audio", "base", "button", "canvas", "embed", "form", "iframe", "input",
            "link", "math", "meta", "object", "script", "select", "style", "svg", "template",
            "textarea", "video",
        ]))
        .filter_style_properties(allowed_styles)
        .attribute_filter(|tag, attribute, value| {
            if attribute.starts_with("on") || attribute.eq_ignore_ascii_case("srcdoc") {
                return None;
            }
            if tag == "a" && attribute == "href" {
                let normalized = value
                    .chars()
                    .filter(|character| !character.is_ascii_control())
                    .collect::<String>();
                let normalized = normalized.trim().to_ascii_lowercase();
                if !normalized.starts_with("http://") && !normalized.starts_with("https://") {
                    return None;
                }
            }
            if tag == "img" && attribute == "src" && value.trim_start().get(..5).is_some_and(|prefix| prefix.eq_ignore_ascii_case("data:")) {
                let encoded = ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"]
                    .iter()
                    .find_map(|prefix| value.strip_prefix(prefix))?;
                if encoded.is_empty()
                    || !encoded.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/' | b'=')) {
                    return None;
                }
            }
            if attribute == "style" {
                let lower_value = value.to_ascii_lowercase();
                if lower_value.contains("url(") || lower_value.contains("@import") {
                    return None;
                }
            }
            Some(value.into())
        });
    builder
}

thread_local! {
    static RICH_TEXT_BUILDER: Builder<'static> = rich_text_builder();
}

pub fn sanitize_rich_text_fragment(html: &str) -> String {
    // Shorten only raster data strings made entirely of inert ASCII characters.
    // Keep their MIME/scheme and HTML context: the normal sanitizer still decides
    // which tags/attributes survive. Restore only tokens surviving that pass.
    // This avoids repeatedly parsing multi-megabyte payloads as URLs and HTML.
    static IMAGES: OnceLock<Regex> = OnceLock::new();
    static TOKENS: OnceLock<Regex> = OnceLock::new();
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let images = IMAGES.get_or_init(|| Regex::new(r"data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+").unwrap());
    if !html.contains("data:image/") {
        return RICH_TEXT_BUILDER.with(|builder| builder.clean(html).to_string());
    }
    let prefix = loop {
        let candidate = format!("PAIDEIAIMAGE{}TOKEN", SEQUENCE.fetch_add(1, Ordering::Relaxed));
        if !html.contains(&candidate) { break candidate; }
    };
    let mut originals = HashMap::new();
    let compact = images.replace_all(html, |captures: &regex::Captures| {
        let matched = captures.get(0).unwrap();
        let original = &html[matched.start()..matched.end()];
        let scheme = original.split_once(',').unwrap().0;
        let token = format!("{scheme},{prefix}{}END", originals.len());
        originals.insert(token.clone(), original);
        token
    });
    let cleaned = RICH_TEXT_BUILDER.with(|builder| builder.clean(&compact).to_string());
    let tokens = TOKENS.get_or_init(|| Regex::new(r"data:image/(?:png|jpeg|webp);base64,PAIDEIAIMAGE[0-9]+TOKEN[0-9]+END").unwrap());
    tokens.replace_all(&cleaned, |captures: &regex::Captures| {
        let token = captures.get(0).unwrap().as_str();
        originals.get(token).copied().unwrap_or(token).to_string()
    }).into_owned()
}

pub(crate) fn sanitize_rich_text_value(value: &mut Value) {
    match value {
        Value::Object(object) => {
            // Custom HTML is a separately sandboxed document. Its package and its
            // SCORM runtime must remain byte-for-byte outside this Rich Text filter.
            if object.get("type").and_then(Value::as_str) == Some("html-custom") {
                return;
            }
            for (key, nested) in object.iter_mut() {
                if RICH_HTML_KEYS.contains(&key.as_str()) {
                    if let Value::String(html) = nested {
                        *html = sanitize_rich_text_fragment(html);
                    }
                } else {
                    sanitize_rich_text_value(nested);
                }
            }
        }
        Value::Array(values) => values.iter_mut().for_each(sanitize_rich_text_value),
        _ => {}
    }
}

pub fn sanitize_rich_text_fields<T>(target: &mut T) -> Result<(), String>
where
    T: Serialize + DeserializeOwned,
{
    let mut value = serde_json::to_value(&*target).map_err(|error| error.to_string())?;
    sanitize_rich_text_value(&mut value);
    *target = serde_json::from_value(value).map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn is_heading_only_rich_text_fragment(html: &str) -> bool {
    Regex::new(
        r#"(?is)^\s*(?:<div\b[^>]*>\s*)*<h[1-6]\b[^>]*>.*?</h[1-6]\s*>(?:\s*</div>)*\s*$"#,
    )
    .expect("valid heading-only Rich Text regex")
    .is_match(html)
}

pub(crate) fn normalize_sanitized_header_fragment(html: &str) -> String {
    let wrapper = Regex::new(
        r"(?is)^\s*<div\b(?P<attributes>[^>]*)>(?P<body>.*)</div>\s*$",
    )
    .expect("valid sanitized header container regex");
    let style = Regex::new(r#"(?is)\s*\bstyle\s*=\s*["'](?P<value>[^"']*)["']"#)
        .expect("valid sanitized header style regex");
    let heading = Regex::new(
        r"(?is)^\s*<(?P<tag>h[1-6])\b(?P<attributes>[^>]*)>(?P<body>.*?)</h[1-6]\s*>\s*$",
    )
    .expect("valid sanitized header heading regex");
    let mut current = html.trim().to_string();
    let mut inherited_styles = Vec::new();

    while let Some(captures) = wrapper.captures(&current) {
        let attributes = captures.name("attributes").map(|value| value.as_str()).unwrap_or_default();
        if let Some(wrapper_style) = style
            .captures(attributes)
            .and_then(|captures| captures.name("value"))
            .map(|value| value.as_str().trim())
            .filter(|value| !value.is_empty())
        {
            inherited_styles.push(wrapper_style.trim_end_matches(';').to_string());
        }
        current = captures.name("body").map(|value| value.as_str().trim().to_string()).unwrap_or_default();
    }

    let Some(captures) = heading.captures(&current) else {
        return html.to_string();
    };
    let attributes = captures.name("attributes").map(|value| value.as_str()).unwrap_or_default();
    if let Some(own_style) = style
        .captures(attributes)
        .and_then(|captures| captures.name("value"))
        .map(|value| value.as_str().trim())
        .filter(|value| !value.is_empty())
    {
        inherited_styles.push(own_style.trim_end_matches(';').to_string());
    }
    let remaining_attributes = style.replace_all(attributes, "");
    let remaining_attributes = remaining_attributes.trim();
    let attributes = if remaining_attributes.is_empty() {
        String::new()
    } else {
        format!(" {remaining_attributes}")
    };
    let styles = if inherited_styles.is_empty() {
        String::new()
    } else {
        format!(" style=\"{}\"", inherited_styles.join(";"))
    };
    let body = captures.name("body").map(|value| value.as_str()).unwrap_or_default();
    let tag = captures
        .name("tag")
        .map(|value| value.as_str().to_ascii_lowercase())
        .unwrap_or_else(|| "h1".to_string());
    format!("<{tag}{attributes}{styles}>{body}</{tag}>")
}

pub fn sanitize_project_rich_text(project: &mut PaideiaProject) -> Result<(), String> {
    sanitize_rich_text_fields(project)?;
    // The sanitizer can serialize a lone heading through one or more safe DIV
    // containers. Header activities keep a directly editable heading after the
    // security pass while preserving the level explicitly chosen by the author.
    for module in &mut project.course.modules {
        for chapter in &mut module.chapters {
            for page in &mut chapter.pages {
                for block in &mut page.blocks {
                    if block.block_type != "header" {
                        continue;
                    }
                    if let Some(html) = block.content_html.as_mut() {
                        *html = normalize_sanitized_header_fragment(html);
                    }
                    if let Some(html) = block.source_raw_html.as_mut() {
                        *html = normalize_sanitized_header_fragment(html);
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_raster_payloads_preserve_sanitizer_decisions_and_content() {
        let payload = "AbC+/=0123".repeat(4_000);
        let image = format!("data:image/png;base64,{payload}");
        for template in [
            "<p><img src=\"IMAGE\" alt=\"Test\" width=\"24\"></p>",
            "<img src='IMAGE' onerror='alert(1)'>",
            "<img src=IMAGE/>",
            "<p>IMAGE</p>",
            "<a href='IMAGE'>link</a>",
            "<script><img src='IMAGE'></script>",
            "<svg><image href='IMAGE' onload='alert(1)'></svg>",
            "<img src='IMAGE&#34; onerror=alert(1)'>",
            "<img src='IMAGE:javascript:alert(1)'>",
            "<img src=' IMAGE'>",
            "<img src='https://example.org/IMAGE'>",
            "<span style='background:url(IMAGE)'>text</span>",
            "<p data-rich-original-text='IMAGE' title='IMAGE'>text</p>",
            "<img src='IMAGE&#65;'>",
            "<template><img src='IMAGE'></template><img src='IMAGE'>",
            "<img src='IMAGE'><img src='data:image/jpeg;base64,AAA='>",
        ] {
            let html = template.replace("IMAGE", &image);
            let expected = rich_text_builder().clean(&html).to_string();
            let actual = sanitize_rich_text_fragment(&html);
            assert_eq!(actual, expected, "{template}");
            assert!(!actual.contains("PAIDEIAIMAGE"));
            assert_eq!(sanitize_rich_text_fragment(&actual), actual);
        }
    }

    #[test]
    #[ignore = "opt-in readonly benchmark of existing personal bank copies"]
    fn benchmark_bank_cleaning_readonly() {
        fn legacy(value: &mut Value) {
            match value {
                Value::Object(object) => {
                    if object.get("type").and_then(Value::as_str) == Some("html-custom") { return; }
                    for (key, nested) in object.iter_mut() {
                        if RICH_HTML_KEYS.contains(&key.as_str()) {
                            if let Value::String(html) = nested { *html = rich_text_builder().clean(html).to_string(); }
                        } else { legacy(nested); }
                    }
                }
                Value::Array(values) => values.iter_mut().for_each(legacy),
                _ => {}
            }
        }
        let root = std::path::PathBuf::from(std::env::var("PAIDEIA_BANK_TEST_SOURCE_ROOT").expect("explicit readonly bank root"));
        for folder in ["question-banks", "reference-banks", "assistants"] {
            for entry in std::fs::read_dir(root.join(folder).join("banks")).unwrap() {
                let path = entry.unwrap().path().join("bank.json");
                if !path.is_file() { continue; }
                let original = std::fs::read(&path).unwrap();
                let mut expected: Value = serde_json::from_slice(&original).unwrap();
                let mut actual = expected.clone();
                let start = std::time::Instant::now(); legacy(&mut expected);
                let old_ms = start.elapsed().as_secs_f64() * 1000.;
                let start = std::time::Instant::now(); sanitize_rich_text_value(&mut actual);
                let new_ms = start.elapsed().as_secs_f64() * 1000.;
                assert_eq!(expected, actual, "identical sanitized output");
                assert_eq!(std::fs::read(&path).unwrap(), original, "original bank unchanged");
                println!("BANK CLEANING {:?}: baseline={old_ms:.2}ms optimized={new_ms:.2}ms", actual["name"]);
            }
        }
    }

    #[test]
    fn removes_executable_content_and_keeps_richbar_markup() {
        let input = r#"<h2 style="color:#244585;text-align:center">Titre</h2><p><strong>Texte</strong> <a href="https://example.org" target="_blank" rel="noopener">lien</a><img class="rich-inline-image" data-paideia-asset-ref="images/a.png" src="assets/images/a.png" width="300"></p><script>alert(1)</script><svg onload="alert(2)"><path d="x"></path></svg><img src="x" onerror="alert(3)"><a href="java&#x73;cript:alert(4)">danger</a>"#;
        let output = sanitize_rich_text_fragment(input);
        assert!(output.contains("<h2"));
        assert!(output.contains("color:#244585"));
        assert!(output.contains("data-paideia-asset-ref=\"images/a.png\""));
        assert!(output.contains("href=\"https://example.org\""));
        assert!(!output.contains("script"));
        assert!(!output.contains("svg"));
        assert!(!output.contains("onerror"));
        assert!(!output.to_ascii_lowercase().contains("javascript:"));
    }

    #[test]
    fn keeps_drop_cap_semantics_and_independent_typography() {
        let output = sanitize_rich_text_fragment(
            r#"<p data-paideia-drop-cap="true"><span class="paideia-rich-drop-cap" style="font-size:72px;color:#8d271c;font-weight:700">É</span>crire</p>"#,
        );

        assert!(output.contains(r#"data-paideia-drop-cap="true""#), "{output}");
        assert!(output.contains(r#"class="paideia-rich-drop-cap""#), "{output}");
        assert!(output.contains("font-size:72px"), "{output}");
        assert!(output.contains("color:#8d271c"), "{output}");
        assert!(output.contains("font-weight:700"), "{output}");
        assert!(output.contains("É</span>crire"), "{output}");
    }

    #[test]
    fn restores_a_direct_heading_without_losing_its_authored_level() {
        let sanitized = sanitize_rich_text_fragment(
            r#"<div style="font-size:18px"><div><h2 style="text-align:center"><span>Synthèse</span></h2></div></div>"#,
        );
        let normalized = normalize_sanitized_header_fragment(&sanitized);

        assert!(normalized.starts_with("<h2"), "{normalized}");
        assert!(normalized.ends_with("</h2>"), "{normalized}");
        assert!(normalized.contains("font-size:18px"), "{normalized}");
        assert!(normalized.contains("text-align:center"), "{normalized}");
        assert!(!normalized.contains("<div"), "{normalized}");
    }

    #[test]
    fn links_accept_only_http_and_https() {
        let output = sanitize_rich_text_fragment(
            r#"<a href="https://ok.example">https</a><a href="http://ok.example">http</a><a href="mailto:a@example.org">mail</a><a href="tel:+331">tel</a><a href="/relative">relative</a>"#,
        );
        assert!(output.contains("href=\"https://ok.example\""));
        assert!(output.contains("href=\"http://ok.example\""));
        assert!(!output.contains("mailto:"));
        assert!(!output.contains("tel:"));
        assert!(!output.contains("href=\"/relative\""));
    }

    #[test]
    fn active_css_urls_are_removed() {
        let output = sanitize_rich_text_fragment(
            r#"<p style="color:#123456;background-image:url(javascript:alert(1))">Texte</p>"#,
        );
        assert!(output.contains("Texte"));
        assert!(!output.to_ascii_lowercase().contains("url("));
        assert!(!output.to_ascii_lowercase().contains("javascript:"));
    }

    #[test]
    fn project_walk_skips_custom_html_but_sanitizes_image360_fragments() {
        let custom_document =
            r#"<html><script>window.customRuntime=true</script><a-scene></a-scene></html>"#;
        let mut value = serde_json::json!({
            "blocks": [
                { "type": "html-custom", "contentHtml": custom_document, "nested": { "titleHtml": "<script>keep()</script>" } },
                { "type": "image-360", "contentHtml": "<p onclick='bad()'>Introduction</p>", "image360Hotspots": [
                    { "title": "Point", "contentHtml": "<p>Corps</p><script>bad()</script>" }
                ] }
            ]
        });
        sanitize_rich_text_value(&mut value);

        assert_eq!(value["blocks"][0]["contentHtml"], custom_document);
        assert_eq!(
            value["blocks"][0]["nested"]["titleHtml"],
            "<script>keep()</script>"
        );
        assert!(!value["blocks"][1]["contentHtml"]
            .as_str()
            .unwrap()
            .contains("onclick"));
        assert!(!value["blocks"][1]["image360Hotspots"][0]["contentHtml"]
            .as_str()
            .unwrap()
            .contains("script"));
    }

    #[test]
    fn sanitizes_reference_bank_definitions() {
        let mut value = serde_json::json!({"referenceBanks":[{"id":"bank","entries":[{"id":"entry","term":"DNS","definitionHtml":"<p onclick='bad()'>Définition</p><script>bad()</script>"}]}]});
        sanitize_rich_text_value(&mut value);
        let definition = value["referenceBanks"][0]["entries"][0]["definitionHtml"].as_str().unwrap();
        assert!(definition.contains("Définition"));
        assert!(!definition.contains("onclick"));
        assert!(!definition.contains("script"));
    }

    #[test]
    fn preserves_raster_definition_images_without_allowing_data_links() {
        let html = "<p><img class=\"rich-inline-image\" src=\"data:image/png;base64,iVBORw0KGgo=\" width=\"24\"><img src=\"data:image/jpeg;base64,/9j/\"><img src=\"data:image/webp;base64,UklGRg==\"><a href=\"data:text/html;base64,PHNjcmlwdD4=\">Lien</a><img src=\"data:image/svg+xml;base64,PHN2Zz4=\"></p>";
        let clean = sanitize_rich_text_fragment(html);
        assert!(clean.contains("data:image/png;base64,iVBORw0KGgo="));
        assert!(clean.contains("data:image/jpeg;base64,/9j/"));
        assert!(clean.contains("data:image/webp;base64,UklGRg=="));
        assert!(!clean.contains("href=\"data:"));
        assert!(!clean.contains("data:image/svg+xml"));
        let large_image = format!("<p><img src=\"data:image/png;base64,{}\"></p>", "A".repeat(1_500_004));
        assert!(sanitize_rich_text_fragment(&large_image).contains(&"A".repeat(1_500_004)));
    }

    #[test]
    fn preserves_large_table_and_split_tracks_on_repeated_saves() {
        let columns = "<col style=\"width:3.125%\">".repeat(32);
        let row = format!("<tr>{}</tr>", "<td><p>Contenu</p></td>".repeat(32));
        let input = format!("<table class=\"paideia-rich-table\" style=\"--paideia-table-custom-width:62%;--paideia-table-custom-offset:13%\"><colgroup>{columns}</colgroup><tbody>{}</tbody></table>", row.repeat(32));
        let output = sanitize_rich_text_fragment(&input);
        assert_eq!(output.matches("<td>").count(), 1024);
        assert_eq!(output.matches("<tr>").count(), 32);
        assert_eq!(output.matches("<col ").count(), 32);
        assert!(output.contains("--paideia-table-custom-offset:13%"));
        assert_eq!(sanitize_rich_text_fragment(&output), output);
        let split = "<table><colgroup><col style=\"width:6.25%\"><col style=\"width:6.25%\"></colgroup><tbody><tr style=\"height:21px\"><td rowspan=\"2\" colspan=\"2\">Texte</td></tr><tr></tr></tbody></table>";
        let clean = sanitize_rich_text_fragment(split);
        for expected in [
            "rowspan=\"2\"",
            "colspan=\"2\"",
            "width:6.25%",
            "height:21px",
        ] {
            assert!(clean.contains(expected));
        }
    }

    #[test]
    fn preserves_authored_indents_and_resized_table_width() {
        let input = r#"<ul style="margin-left:180px"><li style="margin-inline-start:15em">Retrait</li></ul><table class="paideia-rich-table" data-paideia-table-custom-size="true" style="--paideia-table-custom-width:37.5%;--paideia-table-border-width:2px"><tbody><tr><td>Cellule</td></tr></tbody></table>"#;
        let output = sanitize_rich_text_fragment(input);
        for expected in [
            "margin-left:180px",
            "margin-inline-start:15em",
            "--paideia-table-custom-width:37.5%",
            "--paideia-table-border-width:2px",
            "data-paideia-table-custom-size=\"true\"",
        ] {
            assert!(output.contains(expected), "missing {expected} in {output}");
        }
    }

    #[test]
    fn preserves_richbar_tables_markers_and_readability_styles() {
        let input = r#"<ol data-paideia-list-marker="upper-roman"><li style="--paideia-list-marker-color:#244585;--paideia-list-marker-size:20px;--paideia-list-marker-weight:700"><strong>Liste</strong></li></ol><table class="paideia-rich-table" data-paideia-rich-table="true" data-paideia-table-width="80%" style="--paideia-table-border-color:#8d271c;border-collapse:collapse;width:80%"><colgroup><col style="width:40%"><col style="width:60%"></colgroup><tbody><tr><th scope="col" colspan="2" style="background-color:#fff4b8;text-align:center">Titre</th></tr><tr><td rowspan="2" style="border:1px solid #244585"><span data-paideia-bookmark-id="bookmark-1" aria-label="Repère" style="color:#244585;--paideia-rich-outline-color:#ffffff;-webkit-text-stroke-width:1px;paint-order:stroke fill">Texte</span></td><td><span data-paideia-complete-id="blank-1" data-paideia-complete-kind="text" contenteditable="false">Réponse</span></td></tr></tbody></table>"#;
        let output = sanitize_rich_text_fragment(input);
        for expected in [
            "data-paideia-rich-table=\"true\"",
            "data-paideia-table-width=\"80%\"",
            "--paideia-table-border-color:#8d271c",
            "<colgroup>",
            "width:40%",
            "scope=\"col\"",
            "colspan=\"2\"",
            "rowspan=\"2\"",
            "data-paideia-bookmark-id=\"bookmark-1\"",
            "aria-label=\"Repère\"",
            "data-paideia-complete-id=\"blank-1\"",
            "contenteditable=\"false\"",
            "--paideia-rich-outline-color:#ffffff",
            "-webkit-text-stroke-width:1px",
            "paint-order:stroke fill",
            "--paideia-list-marker-color:#244585",
            "--paideia-list-marker-size:20px",
            "--paideia-list-marker-weight:700",
            "data-paideia-list-marker=\"upper-roman\"",
        ] {
            assert!(output.contains(expected), "missing {expected} in {output}");
        }
    }
}
