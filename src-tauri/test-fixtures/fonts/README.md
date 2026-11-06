# Synthetic font fixtures

These fonts were generated for PAIDEIA tests with FontTools FontBuilder. They
contain only `.notdef` and `A`, drawn as a triangle, with a 600-unit advance.
They contain no third-party font data and are not application assets.

`truetype` uses TrueType outlines; `cff` uses OpenType/CFF outlines. Each family
has an uncompressed file and WOFF/WOFF2 versions. Tests check native byte
preservation, catalogue isolation, project application and export CSS formats.

FontTools and Brotli are used only to generate these fixtures, never by PAIDEIA.

`mixed.7z` contains the synthetic CFF OTF, a README, a licence, a dummy preview
and an AppleDouble companion. ZIP coverage builds the equivalent archive in
memory, including a `__MACOSX` entry. Only the genuine font is imported.
