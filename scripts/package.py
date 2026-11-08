"""Package only the standalone extension's public runtime files."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    'manifest.json', 'background.js', 'sidepanel.html', 'standalone.css',
    'standalone-core.js', 'standalone-api.js', 'standalone-ui.js',
    'agent-page.js', 'page-functions.js',
)


def package():
    extension = ROOT / 'extension'
    version = json.loads((extension / 'manifest.json').read_text())['version']
    output = ROOT / 'dist' / f'openwebui-webpage-assistant-{version}.zip'
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            archive.write(extension / name, f'OpenWebUI-Webpage-Assistant/{name}')
        for name in ('README.md', 'PRIVACY.md', 'LICENSE'):
            archive.write(ROOT / name, f'OpenWebUI-Webpage-Assistant/{name}')
    print(output)
    return output


if __name__ == '__main__':
    package()
