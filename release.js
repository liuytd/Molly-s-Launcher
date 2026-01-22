const https = require('https');
const fs = require('fs');
const path = require('path');

// Lire la version depuis version.ml.json
const versionData = JSON.parse(fs.readFileSync('version.ml.json', 'utf-8'));
const VERSION = versionData.version;
const CHANGELOG = versionData.changelog;

// Configuration
const REPO_OWNER = 'liuytd';
const REPO_NAME = 'Molly-s-Launcher';
const INSTALLER_PATH = path.join('dist', 'MollysLauncher-setup.exe');

// Lire le token depuis .github-token
let GITHUB_TOKEN = '';
try {
  const tokenFile = fs.readFileSync('.github-token', 'utf-8');
  GITHUB_TOKEN = tokenFile.split('\n').find(line => !line.startsWith('#') && line.trim()).trim();
} catch (err) {
  console.error('❌ Error: .github-token file not found or invalid');
  console.error('Create .github-token file and add your GitHub token');
  console.error('Get token at: https://github.com/settings/tokens/new');
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error('❌ Error: No GitHub token found in .github-token');
  process.exit(1);
}

// Vérifier que l'installateur existe
if (!fs.existsSync(INSTALLER_PATH)) {
  console.error(`❌ Error: ${INSTALLER_PATH} not found!`);
  console.error('Run: npm run build:production first');
  process.exit(1);
}

console.log(`\n🚀 Creating release v${VERSION}...\n`);

// 1. Créer la release
const releaseData = JSON.stringify({
  tag_name: `v${VERSION}`,
  target_commitish: 'main',
  name: `v${VERSION} - UI improvements`,
  body: `## Changelog\n\n${CHANGELOG.map(item => `- ${item}`).join('\n')}\n\n## Installation\n\nDownload MollysLauncher-setup.exe and run it to install or update.`,
  draft: false,
  prerelease: false
});

const options = {
  hostname: 'api.github.com',
  path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
  method: 'POST',
  headers: {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'User-Agent': 'Node.js',
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(releaseData)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 201) {
      const release = JSON.parse(data);
      console.log(`✅ Release created: ${release.html_url}`);

      // 2. Upload l'installateur
      const uploadUrl = release.upload_url.replace('{?name,label}', '');
      uploadAsset(uploadUrl, INSTALLER_PATH, release.html_url);
    } else {
      console.error(`❌ Release creation failed: ${res.statusCode}`);
      console.error(data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  process.exit(1);
});

req.write(releaseData);
req.end();

function uploadAsset(uploadUrl, filePath, releaseUrl) {
  console.log(`\n📦 Uploading ${path.basename(filePath)}...`);

  const fileStats = fs.statSync(filePath);
  const fileStream = fs.createReadStream(filePath);

  const url = new URL(`${uploadUrl}?name=MollysLauncher-setup.exe`);

  const uploadOptions = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'Node.js',
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileStats.size
    }
  };

  const uploadReq = https.request(uploadOptions, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 201) {
        console.log('✅ Installer uploaded successfully!');
        console.log(`\n✨ Release v${VERSION} is ready!`);
        console.log(`🔗 URL: ${releaseUrl}\n`);
      } else {
        console.error(`❌ Upload failed: ${res.statusCode}`);
        console.error(data);
        process.exit(1);
      }
    });
  });

  uploadReq.on('error', (error) => {
    console.error('❌ Upload error:', error.message);
    process.exit(1);
  });

  fileStream.pipe(uploadReq);
}
