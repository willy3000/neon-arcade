'use strict';
// Writes the two SteamPipe build scripts for the game folder electron-builder produced (release/win-unpacked), into
// release/steam/. Steam delivers that folder as it is and starts "Blackout Protocol.exe" inside it: no installer runs.
// It uploads nothing and needs no Steam account; docs/STEAM_RELEASE.md has the upload steps.
//
// The app and depot numbers come from Steamworks. Give them as STEAM_APP_ID and STEAM_DEPOT_ID, or leave them out and
// replace the placeholders in the two files by hand.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const content = path.join(root, 'release', 'win-unpacked');
const out = path.join(root, 'release', 'steam');
const exe = `${pkg.build.productName}.exe`;
if (!fs.existsSync(path.join(content, exe))) { console.error(`No game at ${content}. Run: npm run dist:steam`); process.exit(1); }

const id = (name, placeholder) => (/^\d+$/.test(process.env[name] || '') ? process.env[name] : placeholder);
const appId = id('STEAM_APP_ID', 'YOUR_APP_ID'), depotId = id('STEAM_DEPOT_ID', 'YOUR_DEPOT_ID');
const vdfPath = (p) => p.replace(/\\/g, '\\\\');
fs.mkdirSync(path.join(out, 'output'), { recursive: true });

fs.writeFileSync(path.join(out, 'app_build.vdf'), `"AppBuild"
{
	"AppID" "${appId}"
	"Desc" "Blackout Protocol ${pkg.version} (Windows x64)"
	"ContentRoot" "${vdfPath(content)}"
	"BuildOutput" "${vdfPath(path.join(out, 'output'))}"
	"Depots"
	{
		"${depotId}" "depot_build.vdf"
	}
}
`);
fs.writeFileSync(path.join(out, 'depot_build.vdf'), `"DepotBuild"
{
	"DepotID" "${depotId}"
	"FileMapping"
	{
		"LocalPath" "*"
		"DepotPath" "."
		"Recursive" "1"
	}
}
`);

const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const all = files(content), bytes = all.reduce((sum, f) => sum + fs.statSync(f).size, 0);
console.log(`Steam build scripts written to ${out}`);
console.log(`  content   ${content} (${all.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  launch    ${exe}   (no arguments needed; --windowed starts in a window)`);
console.log(`  app ${appId} / depot ${depotId}${appId === 'YOUR_APP_ID' ? '   <- placeholders: set STEAM_APP_ID and STEAM_DEPOT_ID, or edit the two .vdf files' : ''}`);
console.log('Nothing was uploaded. See docs/STEAM_RELEASE.md.');
