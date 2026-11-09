#!/usr/bin/env python3
"""Create a minimal VSIX without requiring npm or @vscode/vsce."""

from __future__ import annotations

import json
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
PACKAGE = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
VERSION = PACKAGE["version"]
OUTPUT = ROOT / f"{PACKAGE['name']}-{VERSION}.vsix"


def manifest() -> str:
    categories = ",".join(PACKAGE.get("categories", []))
    keywords = ",".join(PACKAGE.get("keywords", []))
    engine = PACKAGE["engines"]["vscode"]
    return f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="zh-CN" Id="{escape(PACKAGE['name'])}" Version="{escape(VERSION)}" Publisher="{escape(PACKAGE['publisher'])}" />
    <DisplayName>{escape(PACKAGE['displayName'])}</DisplayName>
    <Description xml:space="preserve">{escape(PACKAGE['description'])}</Description>
    <Tags>{escape(keywords)}</Tags>
    <Categories>{escape(categories)}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{escape(engine)}" />
      <Property Id="Microsoft.VisualStudio.Services.Content.Pricing" Value="Free" />
      <Property Id="Microsoft.VisualStudio.Services.Content.Preview" Value="false" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />
  </Assets>
</PackageManifest>
'''


CONTENT_TYPES = '''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Override PartName="/extension/LICENSE" ContentType="text/plain" />
</Types>
'''


def main() -> None:
    source_files = [
        "package.json", "extension.js", "README.md", "CHANGELOG.md", "LICENSE",
    ]
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        archive.writestr("extension.vsixmanifest", manifest())
        archive.writestr("[Content_Types].xml", CONTENT_TYPES)
        for relative_path in source_files:
            archive.write(ROOT / relative_path, f"extension/{relative_path}")
    print(OUTPUT)


if __name__ == "__main__":
    main()
