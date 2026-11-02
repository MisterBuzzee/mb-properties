name 'mb-properties'
author 'TGIANN'
version '0.1.3' -- x-release-please-version
license 'GPL-3.0-only'
description 'Houses and apartments: buy, enter a private interior, stash, keys, sell'
repository 'https://github.com/aifivem/mb-properties'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/properties.json',
	'data/interiors.json',
	'data/furniture.json',
}
