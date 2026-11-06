use std::io::{Cursor, Write};
use serde::Deserialize;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

pub const INVENTORY_JSON: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../legal/third-party-notices.json"));

#[derive(Deserialize)]
struct Inventory { components: Vec<Component>, sections: Vec<NoticeText> }
#[derive(Deserialize)]
struct Component {
    group: String, name: String, version: String, license: String, source: String,
    #[serde(rename = "descriptionEn")]
    description_en: Option<String>,
    description: Option<String>, notices: Vec<NoticeRef>,
}
#[derive(Deserialize)]
struct NoticeRef { section: usize }
#[derive(Deserialize)]
struct NoticeText { id: usize, text: String }

fn xml(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
        .replace('"', "&quot;").replace('\'', "&apos;")
}

fn paragraph(style: &str, text: &str) -> String {
    let content = text.split('\n').map(|line| format!("<w:t xml:space=\"preserve\">{}</w:t>", xml(line)))
        .collect::<Vec<_>>().join("<w:br/>");
    format!("<w:p><w:pPr><w:pStyle w:val=\"{}\"/></w:pPr><w:r>{}</w:r></w:p>", style, content)
}

pub fn word_document(language: &str) -> Result<Vec<u8>, String> {
    let inventory: Inventory = serde_json::from_str(INVENTORY_JSON).map_err(|error| error.to_string())?;
    let french = language.eq_ignore_ascii_case("fr");
    let mut body = paragraph("Title", if french { "Composants tiers et polices de PAIDEIA" } else { "PAIDEIA third party components and fonts" });
    body.push_str(&paragraph("Normal", if french {
        "Ce document répertorie les composants tiers documentés et les douze familles de polices embarquées. Les notices originales disponibles et les textes de référence identifiés sont reproduits dans leur langue d’origine. Les attributions propres au runtime Microsoft restent également disponibles dans ce runtime."
    } else {
        "This document lists documented third party components and the twelve bundled font families. Available original notices and identified reference texts are reproduced in their original language. Microsoft runtime-specific attributions are also available in that runtime."
    }));
    let mut group = String::new();
    for component in &inventory.components {
        if group != component.group {
            group = component.group.clone();
            let heading = if !french && group == "Polices" { "Fonts" } else { &group };
            body.push_str(&paragraph("Heading1", heading));
        }
        body.push_str(&paragraph("Heading2", &format!("{} {}", component.name, component.version).trim()));
        body.push_str(&paragraph("Normal", &format!("{} : {}", if french { "Licence déclarée" } else { "Declared licence" }, component.license)));
        if !component.source.is_empty() { body.push_str(&paragraph("Normal", &format!("Source : {}", component.source.trim_start_matches("git+")))); }
        if french {
            if let Some(description) = &component.description { body.push_str(&paragraph("Normal", description)); }
        } else if let Some(description) = &component.description_en {
            body.push_str(&paragraph("Normal", description));
        } else if component.group == "Runtime" {
            body.push_str(&paragraph("Normal", "Microsoft supplies Chromium and third-party attributions in the fixed runtime."));
        }
        for reference in &component.notices {
            let notice = inventory.sections.iter().find(|notice| notice.id == reference.section)
                .ok_or_else(|| format!("Missing licence for {}", component.name))?;
            for block in notice.text.split("\n\n") { body.push_str(&paragraph("Normal", block)); }
        }
    }
    let document = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>"#, body);
    let styles = r#"<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:before="240" w:after="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>"#;
    let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    for (name, content) in [
        ("[Content_Types].xml", r#"<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>"#),
        ("_rels/.rels", r#"<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"#),
        ("word/_rels/document.xml.rels", r#"<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>"#),
        ("word/styles.xml", styles), ("word/document.xml", document.as_str()),
    ] {
        archive.start_file(name, options).map_err(|error| error.to_string())?;
        archive.write_all(content.as_bytes()).map_err(|error| error.to_string())?;
    }
    Ok(archive.finish().map_err(|error| error.to_string())?.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    #[test]
    fn notices_word_download_contains_inventory_fonts_and_full_licences() {
        let inventory: Inventory = serde_json::from_str(INVENTORY_JSON).unwrap();
        assert_eq!(inventory.components.iter().filter(|component| component.group == "Polices").count(), 12);
        for language in ["fr", "en"] {
            let bytes = word_document(language).unwrap();
            let mut archive = zip::ZipArchive::new(Cursor::new(&bytes)).unwrap();
            let mut text = String::new();
            archive.by_name("word/document.xml").unwrap().read_to_string(&mut text).unwrap();
            for component in &inventory.components {
                let heading = paragraph("Heading2", &format!("{} {}", component.name, component.version).trim());
                let start = text.find(&heading).unwrap() + heading.len();
                let following = &text[start..];
                let end = following.find("<w:p><w:pPr><w:pStyle w:val=\"Heading2\"").unwrap_or(following.len());
                let component_text = &following[..end];
                for reference in &component.notices {
                    let notice = inventory.sections.iter().find(|notice| notice.id == reference.section).unwrap();
                    for line in notice.text.lines().filter(|line| !line.is_empty()) {
                        assert!(component_text.contains(&xml(line)), "licence separated from {}", component.name);
                    }
                }
            }
            assert!(!text.contains("user-imported fonts"));
            assert!(!text.contains("polices importées"));
            for notice in &inventory.sections {
                for line in notice.text.lines().filter(|line| !line.is_empty()) { assert!(text.contains(&xml(line)), "missing text {}", notice.id); }
            }
            assert!(text.contains("TOAST UI"));
            if let Some(directory) = std::env::var_os("PAIDEIA_LEGAL_QA_OUTPUT") {
                std::fs::create_dir_all(&directory).unwrap();
                std::fs::write(std::path::PathBuf::from(directory).join(format!("notices-{}.docx", language)), bytes).unwrap();
            }
        }
    }
}
