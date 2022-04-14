'use strict'

const fs = require('fs')
const URL = require('url').URL
const path = require('path')

const config = require('../config')
const logger = require('../logger')
const { imageHash } = require('image-hash')


/**
 * generate a filename through the image-hash
 */
async function pickFilename (filepath) {
  const ext = path.extname(path.basename(filepath))
  return new Promise((resolve, reject) => {
    imageHash(filepath, 8, true, (error, data) => {
      if (error) reject(error)
      resolve(`${data}${ext}`)
    });
  })
}

// if it already exists, then do not copy file to `/uploads`
exports.uploadImage = async function (imagePath, callback) {
  logger.info(`fs.uploadImage start ${imagePath}`)
  if (!imagePath || typeof imagePath !== 'string') {
    callback(new Error('Image path is missing or wrong'), null)
    return
  }

  if (!callback || typeof callback !== 'function') {
    logger.error('Callback has to be a function')
    return
  }

  let filename = path.basename(imagePath)
  try {
    filename = await pickFilename(imagePath)
  } catch (e) {
    return callback(e, null)
  }

  if (!fs.existsSync(path.join(config.uploadsPath, filename))) {
    try {
      fs.copyFileSync(imagePath, path.join(config.uploadsPath, filename))
    } catch (e) {
      return callback(e, null)
    }
  }

  let url
  try {
    url = (new URL(filename, config.serverURL + '/uploads/')).href
  } catch (e) {
    url = config.serverURL + '/uploads/' + filename
  }

  callback(null, url)
}
