const transcode = require('buffer').transcode
const fs = require('fs')
const plist = require('plist')
const SmartBuffer = require('smart-buffer').SmartBuffer
const childProcess = require('child_process')
const Iconv = require('iconv').Iconv
const bufferFrom = require('buffer-from')
const {isArray, arrayify} = require('./util')
const languages = require('./languages')
const {IconvCache, tryCharEncode} = require('./iconv-helpers')
const {freeze} = Object;

export { Labels, NoLabels } from "./Labels";
export { BodySpec, LabelsSpec, LicenseSpec } from "./spec";

export interface Options {
	resolvePath?(path: string): string;
	onNonFatalError?(error: Error): void;
}

/**
 * @param {LicenseConfig} config
 * @param {ResolvePath} resolvePath
 * @return {Promise<plist.PlistObject>}
 */
function generatePlist (config, resolvePath) {
	/**
	 * Array of license texts, indexed by locale ID.
	 *
	 * @type {LicenseText[]}
	 */
	const texts = []

	/**
	 * Count of license texts. This is needed because texts is a sparse array, so texts.length will not return the actual count.
	 */
	let numTexts = 0

	/**
	 * If more than one license file applies to the same locale, this will contain the extras, indexed by locale ID.
	 *
	 * @type {LicenseText[][]}
	 */
	const collisions = []

	return Promise.all(config.languages.map(text => loadLicense(text, resolvePath).then(loaded => {
		for (let id of loaded.localeIDs) {
			if (texts[id]) {
				if (!collisions[id]) {
					collisions[id] = [loaded]
				} else {
					collisions[id].push(loaded)
				}
			} else {
				texts[id] = loaded
				numTexts++
			}
		}
	}))).then(() => {
		if (collisions.length) {
			let message = 'For some languages, more than one license file was given. They are listed here by their classic Mac OS locale code.'

			for (let collID in collisions) {
				collisions[collID].unshift(texts[collID])

				message += '\n'
				message += String(collID)
				message += ' ('
				message += languages.byRegionCode[collID].langTags.join(', ')
				message += '):'

				for (let collision of collisions[collID]) {
					message += '\n• '
					message += collision.file
				}
			}

			throw new Error(message)
		}

		/** @type {Object.<string, plist.PlistValue[]>} */
		const entries = {
			'LPic': [],
			'STR#': []
		}

		// Assemble the resources.

		let LPicData = SmartBuffer.fromSize(4 + (6 * numTexts))

		// Generate LPic header.
		// The first field is the default language ID.
		{
			let locale = (config.defaultLanguage !== undefined)
				? config.defaultLanguage
				: arrayify(config.languages[0].lang)[0]

			LPicData.writeInt16BE(languages.byLocale[locale].id)
		}

		// The second field is the count of languages available.
		LPicData.writeUInt16BE(numTexts)

		for (let langID of texts.keys()) {
			// LPic field 1: system language ID
			LPicData.writeInt16BE(langID)

			// LPic field 2: local resource ID minus 5000
			// We always use the same resource ID as the locale ID, since no other TEXT/utxt/RTF /STR# resources are likely to appear in a UDIF image at all, let alone have one of those IDs.
			LPicData.writeInt16BE(langID)

			// LPic field 3: 2-byte language?
			// We never use multi-byte encodings in TEXT resources, only ASCII. Non-ASCII text is encoded as UTF-16 and stored in utxt resources instead, and RTF uses escape sequences to represent non-ASCII characters. Therefore, this field is always zero.
			LPicData.writeInt16BE(0)

			let lang = languages.byRegionCode[langID]
			let text = texts[langID]
			let resID = String(5000 + langID)

			// Add STR# and TEXT/utxt/RTF resources for this license text.

			entries['STR#'].push({
				Attributes: '0x0000',
				Data: lang.strings,
				ID: resID,
				Name: lang.englishName + ' buttons'
			})

			if (!(text.type in entries)) {
				entries[text.type] = []
			}

			entries[text.type].push({
				Attributes: '0x0000',
				Data: text.data,
				ID: resID,
				Name: lang.englishName
			})
		}

		entries.LPic[0] = {
			Attributes: '0x0000',
			Data: LPicData.toBuffer(),
			ID: '5000',
			Name: ''
		}

		return entries
	})
}

/**
 * @param {plist.PlistValue} pl
 * @param {import('stream').Writable} to
 * @return {Promise<void>}
 */
function writePlist (pl, to) {
	return new Promise((resolve, reject) => {
		let pls = plist.build(pl)
		to.write(pls, 'utf-8', err => {
			if (err) {
				reject(err)
			} else {
				to.end(resolve)
			}
		})
	})
}

/**
 * @param {string} imagePath
 * @param {plist.PlistValue} pl
 * @return {Promise<void>}
 */
function runHdiutilUdifRez (imagePath, pl) {
	let child = childProcess.spawn('hdiutil', ['udifrez', '-xml', '/dev/fd/3', imagePath, imagePath], {
		stdio: ['inherit', 'inherit', 'inherit', 'pipe']
	})

	/** @type {Promise<void>} */
	let childPromise = new Promise((resolve, reject) => {
		let exited = false

		let timeout = setTimeout(() => {
			if (!exited && !child.killed) {
				child.kill()
				reject(new Error('Timed out waiting for child process'))
			}
		}, 10000)

		child.on('error', error => {
			exited = true
			clearTimeout(timeout)
			child.unref()

			reject(error)
		})

		child.on('exit', code => {
			exited = true
			clearTimeout(timeout)
			child.unref()

			if (code) {
				reject(new Error(`Child process exited with code ${code}`))
			} else {
				resolve()
			}
		})
	})

	let writing = writePlist(pl, /** @type {import('stream').Writable} */ (child.stdio[3]))

	return Promise.all([childPromise, writing]).then(() => {})
}

/**
 * @param {LicenseConfig} config
 * @param {string} imagePath
 * @param {ResolvePath} resolvePath
 * @param {function(?Error=): void} cb
 */
module.exports = function attachLicense (config, imagePath, resolvePath, cb) {
	generatePlist(config, resolvePath)
	.then(pl => runHdiutilUdifRez(imagePath, pl))
	.then(() => cb(), err => cb(err))
}
