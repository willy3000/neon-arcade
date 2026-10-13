'use strict';
// Runs once electron-builder has put the game together in release/win-unpacked (build.afterPack in package.json) and
// before the installer and portable exe are made from it, so all three carry the same switches.
//
// Electron's "fuses" are switches inside the exe itself. Flipping them here means the released game:
//   - cannot be started as a plain Node.js program (ELECTRON_RUN_AS_NODE), read extra options from NODE_OPTIONS, or be
//     opened for debugging with --inspect;
//   - only loads its code from resources/app.asar, and refuses to start if that file does not match the checksum
//     electron-builder recorded inside the exe.
// None of this hides the game's files: app.asar is an archive anyone can unpack, not encryption.
const path = require('node:path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await flipFuses(exe, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  });
  console.log(`  • fuses set on ${path.basename(exe)}`);
};
