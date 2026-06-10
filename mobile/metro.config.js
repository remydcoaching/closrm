const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch shared/ folder so types/validations partagés (workspace ../shared)
// sont resolvables depuis mobile/ via l'alias @shared/* (cf. tsconfig.json).
config.watchFolders = [path.resolve(__dirname, '../shared')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
// extraNodeModules permet aux fichiers de ../shared/ de résoudre les libs npm
// (ex: zod) depuis mobile/node_modules — sans ça, shared/validations/*.ts
// ne trouvent pas zod car shared/ n'a pas son propre node_modules.
config.resolver.extraNodeModules = {
  '@shared': path.resolve(__dirname, '../shared'),
  zod: path.resolve(__dirname, 'node_modules/zod'),
};

module.exports = withNativeWind(config, { input: './global.css' });
