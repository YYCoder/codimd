const response = require('../response')
// const config = require('../config')
const models = require('../models')
const logger = require('../logger')

exports.getTags = async (req, res) => {
  if (!req.isAuthenticated()) {
    return response.errorForbidden(req, res)
  }

  const userId = req.user.id
  try {
    const tags = await models.Tag.findAll({
      where: {
        ownerId: userId
      },
      defaults: { count: 0 }
    })
  
    res.send({
      tags,
      status: 'ok',
    })
  } catch(e) {
    logger.error(`getTags failed, err: ${e}`)
    return response.errorInternalError(req, res)
  }
}

exports.addTag = async (req, res) => {
  if (!req.isAuthenticated()) {
    return response.errorForbidden(req, res)
  }
  logger.info(`addTag req.body ${JSON.stringify(req.body, null, '  ')}`)

  const name = req.body.name
  const count = req.body.count ?? 0
  const userId = req.user.id
  
  if (!name) {
    return res.send({
      status: 'failed',
      msg: 'name is required'
    })
  }
  try {
    let msg = ''
    const [tag, created] = await models.Tag.findOrCreate({
      where: {
        name,
        count,
        ownerId: userId
      },
    })
    if (created) {
      logger.info(`addTag succeed, id: ${tag.id}`)
      msg = 'create succeed'
    } else {
      logger.info(`tag already exists, id: ${tag.id}`)
      msg = 'tag already exists'
    }
  
    res.send({
      msg,
      tag,
      status: 'ok',
    })
  } catch(e) {
    logger.error(`addTag failed, err: ${e}`)
    return response.errorInternalError(req, res)
  }
}

exports.updateTag = async (req, res) => {
  if (!req.isAuthenticated()) {
    return response.errorForbidden(req, res)
  }
  
  const { name, count } = req.body
  const { id } = req.params
  
  if (!id) {
    return res.send({
      status: 'failed',
      msg: 'id is required'
    })
  }
  try {
    logger.info(`updateTag: ${id}, ${name}, count ${count}`)
    const opt = {}
    if (name) {
      opt.name = name
    }
    if (count) {
      opt.count = count
    }
    const [rows] = await models.Tag.update(opt, {
      where: { id: +id }
    })
    logger.info(`updateTag succeed, affected rows: ${rows}`)
  
    res.send({
      status: 'ok',
      rows: rows
    })
  } catch(e) {
    logger.error(`updateTag failed, err: ${e}`)
    return response.errorInternalError(req, res)
  }
}

exports.deleteTag = async (req, res) => {
  if (!req.isAuthenticated()) {
    return response.errorForbidden(req, res)
  }

  const tagId = req.params.id
  const tag = await models.Tag.findOne({
    where: {
      id: tagId,
      ownerId: req.user.id
    }
  })

  if (!tag) {
    res.status(404).send({
      status: 'not found'
    })
    return
  }

  // 需要校验该 tag 是否还被其他 note 引用
  const notes = await models.Note.findAll({
    where: {
      ownerId: req.user.id,
    }
  })

  const hasRef = notes.some((note) => {
    const { tagIdList } = note
    try {
      if (Array.isArray(tagIdList)) {
        return tagIdList.includes(+tagId)
      } else {
        return false
      }
    } catch(e) {
      logger.error(`error ${e}`)
      return false
    }
  })

  logger.info(`tag id ${tagId} hasRef: ${hasRef}, can't delete`)

  if (!hasRef) {
    try {
      await tag.destroy()
      res.send({
        status: 'ok'
      })
    } catch(e) {
      return response.errorInternalError(req, res)
    }
  }
  
  return res.send({
    status: 'failed',
    msg: 'tag has reference'
  })
}
