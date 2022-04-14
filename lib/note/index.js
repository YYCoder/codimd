'use strict'

const config = require('../config')
const logger = require('../logger')
const { Note, User, Revision, Tag, sequelize } = require('../models')
const { Op } = require('sequelize')

const { newCheckViewPermission, errorForbidden, responseCodiMD, errorNotFound, errorInternalError } = require('../response')
const { updateHistory, historyDelete } = require('../history')
const { actionPublish, actionSlide, actionInfo, actionDownload, actionPDF, actionGist, actionRevision, actionPandoc } = require('./noteActions')
const realtime = require('../realtime/realtime')

async function getNoteById (noteId, { includeUser } = { includeUser: false }) {
  const id = await Note.parseNoteIdAsync(noteId)

  const includes = []

  if (includeUser) {
    includes.push({
      model: User,
      as: 'owner'
    }, {
      model: User,
      as: 'lastchangeuser'
    })
  }

  const note = await Note.findOne({
    where: {
      id: id
    },
    include: includes
  })
  return note
}

// controller
async function showNote (req, res) {
  const noteId = req.params.noteId
  const userId = req.user ? req.user.id : null
  
  logger.info(`showNote start: ${noteId}, userId ${userId}`)

  let note = await getNoteById(noteId)

  if (!note) {
    // if config.allowFreeURL && config.allowAnonymous both are enabled, auto create note
    if (!config.allowFreeURL || config.forbiddenNoteIDs.includes(noteId)) {
      return errorNotFound(req, res)
    } else if (!config.allowAnonymous && !userId) {
      return errorForbidden(req, res)
    }
    return errorNotFound(req, res)
  }
  
  await note.increment('viewcount')

  if (!newCheckViewPermission(note, req.isAuthenticated(), userId)) {
    return errorForbidden(req, res)
  }

  // force to use note id
  // const id = Note.encodeNoteId(note.id)
  // if ((note.alias && noteId !== note.alias) || (!note.alias && noteId !== id)) {
  //   return res.redirect(config.serverURL + '/' + (note.alias || id))
  // }
  return responseCodiMD(res, note)
}

function canViewNote (note, isLogin, userId) {
  if (note.permission === 'private') {
    return note.ownerId === userId
  }
  if (note.permission === 'limited' || note.permission === 'protected') {
    return isLogin
  }
  return true
}

async function showPublishNote (req, res) {
  const shortid = req.params.shortid

  const note = await getNoteById(shortid, {
    includeUser: true
  })

  if (!note) {
    return errorNotFound(req, res)
  }

  if (!canViewNote(note, req.isAuthenticated(), req.user ? req.user.id : null)) {
    return errorForbidden(req, res)
  }

  if ((note.alias && shortid !== note.alias) || (!note.alias && shortid !== note.shortid)) {
    return res.redirect(config.serverURL + '/s/' + (note.alias || note.shortid))
  }

  await note.increment('viewcount')

  const body = note.content
  const extracted = Note.extractMeta(body)
  const markdown = extracted.markdown
  const meta = Note.parseMeta(extracted.meta)
  const createTime = note.createdAt
  const updateTime = note.lastchangeAt
  const title = Note.generateWebTitle(meta.title || Note.decodeTitle(note.title))

  const data = {
    title: title,
    description: meta.description || (markdown ? Note.generateDescription(markdown) : null),
    image: meta.image,
    viewcount: note.viewcount,
    createtime: createTime,
    updatetime: updateTime,
    body: body,
    owner: note.owner ? note.owner.id : null,
    ownerprofile: note.owner ? User.getProfile(note.owner) : null,
    lastchangeuser: note.lastchangeuser ? note.lastchangeuser.id : null,
    lastchangeuserprofile: note.lastchangeuser ? User.getProfile(note.lastchangeuser) : null,
    robots: meta.robots || false, // default allow robots
    GA: meta.GA,
    disqus: meta.disqus,
    cspNonce: res.locals.nonce
  }

  res.set({
    'Cache-Control': 'private' // only cache by client
  })

  res.render('pretty.ejs', data)
}

async function noteActions (req, res) {
  const noteId = req.params.noteId

  const note = await getNoteById(noteId)

  if (!note) {
    return errorNotFound(req, res)
  }

  if (!canViewNote(note, req.isAuthenticated(), req.user ? req.user.id : null)) {
    return errorForbidden(req, res)
  }

  const action = req.params.action
  switch (action) {
    case 'publish':
    case 'pretty': // pretty deprecated
      return actionPublish(req, res, note)
    case 'slide':
      return actionSlide(req, res, note)
    case 'download':
      actionDownload(req, res, note)
      break
    case 'info':
      actionInfo(req, res, note)
      break
    case 'pdf':
      if (config.allowPDFExport) {
        actionPDF(req, res, note)
      } else {
        logger.error('PDF export failed: Disabled by config. Set "allowPDFExport: true" to enable. Check the documentation for details')
        errorForbidden(req, res)
      }
      break
    case 'gist':
      actionGist(req, res, note)
      break
    case 'revision':
      actionRevision(req, res, note)
      break
    case 'pandoc':
      actionPandoc(req, res, note)
      break
    default:
      return res.redirect(config.serverURL + '/' + noteId)
  }
}

async function getNoteTags (req, res) {
  logger.info(`getNoteTags params: ${JSON.stringify(req.params, null, '  ')}`)
  if (!req.params.noteId) {
    return res.send({
      msg: 'note not found'
    })
  }
  try {
    logger.info(`start fetch note by id, ${req.params.noteId}`)
    const note = await getNoteById(req.params.noteId)
    if (!note) return res.send({
      msg: 'note not found'
    })

    logger.info(`start query tag by tagIdList, ${note.tagIdList}`)
    let tags = await Tag.findAll({
      where: {
        id: {
          [Op.in]: note.tagIdList
        }
      }
    })
    logger.info(`fetched tags, ${tags}`)
    res.send({
      tags,
    })
  } catch(err) {
    return errorInternalError(req, res)
  }
}

// 支持根据 tag 搜索、关键字（全文）搜索，根据修改时间排序，分页
async function getMyNoteList (req) {
  const where = [
    {
      ownerId: req.user.id
    }
  ]
  const {
    keyword = '', name = '',
    tagIds: tagIdQuery,
    limit = 20, page = 0,
    orderBy = '',
    order = '',
  } = req.query
  // `keyword` and `name` are OR relation, not AND
  if (keyword || name) {
    const opts = []
    if (keyword) {
      opts.push({
        content: {
          [Op.like]: `%${keyword}%`
        }
      })
    }
    if (name) {
      opts.push({
        title: {
          [Op.like]: `%${name}%`
        }
      })
    }
    where.push({
      [Op.or]: opts
    })
  }
  // if query `tagIds` only passed one, it would be a string, otherwise, it would be an Array
  if (typeof(tagIdQuery) === 'string') {
    // 使用 JSON_CONTAINS(layout_status, '["Retired","Layouted"]') 这种方式过滤 json array
    where.push(sequelize.fn('JSON_CONTAINS', sequelize.col('tagIdList'), `[${+tagIdQuery}]`))
  }
  if (Array.isArray(tagIdQuery) && tagIdQuery.length > 0) {
    const tags = tagIdQuery.map(t => +t).join(',')
    where.push(sequelize.fn('JSON_CONTAINS', sequelize.col('tagIdList'), `[${tags}]`))
  }
  const orderOpt = orderBy ? sequelize.literal(`${orderBy} ${order ? order : 'ASC'}`) : ''
  
  logger.info(`findAndCountAll start`)
  try {
    // 搜索
    let { rows: myNotes, count: total } = await Note.findAndCountAll({
      where: {
        [Op.and]: where
      },
      limit: +limit,
      offset: page*limit,
      order: orderOpt
    })
    logger.info(`findAndCountAll done, myNotes: ${myNotes}`)
    if (!myNotes) {
      return []
    }
    // 处理数据
    const tagIds = Array.from(
      new Set(
        myNotes.reduce((res, n) => {
          const tagIdList = Array.isArray(n.tagIdList) ? n.tagIdList : []
          return [...tagIdList, ...res]
        }, [])
      )
    )
    const tagsMap = new Map()

    logger.info(`start query tag by tagIdList, ${tagIds}`)
    const tags = await Tag.findAll({
      where: {
        id: {
          [Op.in]: tagIds
        }
      }
    })
    logger.info(`fetched tags, ${tags}`)
    tags.forEach((t) => tagsMap.set(t.id, t))

    const myNoteList = myNotes.map(note => {
      const tags = note.tagIdList.map(id => tagsMap.get(id)).filter(t => !!t)
      return {
        tags,
        id: Note.encodeNoteId(note.id),
        alias: note.alias,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt,
        lastchangeAt: note.lastchangeAt,
        shortId: note.shortid,
        viewcount: note.viewcount,
        permission: note.permission,
      }
    })
    if (config.debug) {
      logger.info('Parse myNoteList success: ' + req.user.id)
    }
    return [myNoteList, total]
  } catch (err) {
    logger.error(`Parse myNoteList failed, ${err}`)
    return []
  }
}

async function listMyNotes (req, res) {
  if (req.isAuthenticated()) {
    logger.info(`listMyNotes query: ${JSON.stringify(req.query, null, '  ')}`)
    try {
      const [list = [], total = 0] = await getMyNoteList(req)
      if (!list) return errorNotFound(req, res)
      res.send({
        total,
        myNotes: list
      })
    } catch(err) {
      return errorInternalError(req, res)
    }
  } else {
    return errorForbidden(req, res)
  }
}

// 通用的修改 note 的 tag 方法
const updateNoteTag = async (req, res, isAdd) => {
  if (!req.isAuthenticated()) {
    return errorForbidden(req, res)
  }
  const noteId = req.params.noteId
  const tagId = req.body.tag_id
  if (!noteId || !tagId) {
    return res.send({
      status: 'failed',
      msg: 'noteId and tagId are required'
    })
  }

  try {
    const note = await getNoteById(noteId)
    if (!note) {
      throw new Error(`can't find note ${noteId}`)
    }
    
    const newTagIdList = isAdd ?
      Array.from(new Set([...note.tagIdList, tagId])) :
      note.tagIdList.filter((id) => id !== +tagId)
    
    if (newTagIdList.length === note.tagIdList.length) {
      throw new Error(`same tagIdList.length, delete an non-exist tag or adding an existed tag, tagId: ${tagId}`)
    }
    const trxRes = await sequelize.transaction((t) => {
      logger.info(`start transaction`)
      // 更新 note 的 tagIdList
      return Note.update({
        tagIdList: newTagIdList.map(tid => +tid),
      }, {
        where: { id: note.id },
        transaction: t
      }).then(([rows]) => {
        if (rows === 0) {
          logger.info('same tagIdList')
          return
        }
        // 先查询，再同步更新 tag 的引用次数
        return Tag.findOne({
          where: {
            id: tagId,
          },
          transaction: t
        })
      }).then((tag) => {
        logger.info(`start update tag count`)
        if (!tag) {
          logger.error(`can't find tag ${tagId}`)
          throw new Error(`can't find tag ${tagId}`)
        }
        const count = isAdd ? tag.count + 1 : tag.count-1 >= 0 ? tag.count-1 : 0
        
        return Tag.update({ count }, {
          where: { id: tagId },
          transaction: t
        })
      }).then(([rows]) => {
        logger.info(`update tag count succeed, affected rows: ${rows}`)
        if (rows > 0) {
          return true
        }
        return false
      })
    })
    logger.info(`transaction done, res: ${trxRes}`)
    
    return res.send({
      status: 'ok'
    })
  } catch(e) {
    logger.error(`deleteNoteTag failed: ${e}`)
    return errorInternalError(req, res)
  }
}

const deleteNoteTag = async (req, res) => {
  return updateNoteTag(req, res, false)
}

const addNoteTag = async (req, res) => {
  return updateNoteTag(req, res, true)
}

const deleteNote = async (req, res) => {
  if (!req.isAuthenticated()) {
    return errorForbidden(req, res)
  }
  const noteId = await Note.parseNoteIdAsync(req.params.noteId)

  try {
    const note = await Note.findOne({
      where: {
        id: noteId,
      }
    })
    if (!note) {
      throw new Error(`can't find note ${noteId}`)
    }
    
    const destroyed = await Note.destroy({
      where: {
        id: noteId,
        ownerId: req.user.id
      }
    })
    if (!destroyed) {
      logger.error('Delete note failed: Make sure the noteId and ownerId are correct.')
      return errorNotFound(req, res)
    }
    // 该文档所有的 tag count-1
    logger.info(`updating tagIdList ${note.tagIdList}, count - 1`)
    if (note.tagIdList.length === 0) {
      logger.error(`note ${noteId} has no tag, pass`)
      return
    }
    await Tag.update({
      count: sequelize.literal('count - 1')
    }, {
      where: {
        id: {
          [Op.in]: note.tagIdList
        }
      }
    })
    logger.info(`updating tagIdList ${note.tagIdList} succeed`)

    historyDelete(req, res)
    
    if (realtime.isNoteExistsInPool(noteId)) {
      const note = realtime.getNoteFromNotePool(noteId)
      realtime.disconnectSocketOnNote(note)
    }
    
    res.send({
      status: 'ok'
    })
  } catch (err) {
    logger.error(`Delete note failed: Internal Error: ${err}`)
    return errorInternalError(req, res)
  }
}

const updateNote = async (req, res) => {
  if (req.isAuthenticated() || config.allowAnonymousEdits) {
    const noteId = await Note.parseNoteIdAsync(req.params.noteId)
    try {
      const note = await Note.findOne({
        where: {
          id: noteId
        }
      })
      if (!note) {
        logger.error('Update note failed: Can\'t find the note.')
        return errorNotFound(req, res)
      }

      if (realtime.isNoteExistsInPool(noteId)) {
        logger.error('Update note failed: There are online users opening this note.')
        return res.status('403').json({ status: 'error', message: 'Update API can only be used when no users is online' })
      }

      const now = Date.now()
      const content = req.body.content
      const updated = await note.update({
        title: Note.parseNoteTitle(content),
        content: content,
        lastchangeAt: now,
        authorship: [
          [
            req.isAuthenticated() ? req.user.id : null,
            0,
            content.length,
            now,
            now
          ]
        ]
      })

      if (!updated) {
        logger.error('Update note failed: Write note content error.')
        return errorInternalError(req, res)
      }

      if (req.isAuthenticated()) {
        updateHistory(req.user.id, noteId, content)
      }

      Revision.saveNoteRevision(note, (err, revision) => {
        if (err) {
          logger.error(err)
          return errorInternalError(req, res)
        }
        if (!revision) return errorNotFound(req, res)
        res.send({
          status: 'ok'
        })
      })
    } catch (err) {
      logger.error(err.stack)
      logger.error('Update note failed: Internal Error.')
      return errorInternalError(req, res)
    }
  } else {
    return errorForbidden(req, res)
  }
}

exports.showNote = showNote
exports.showPublishNote = showPublishNote
exports.noteActions = noteActions
exports.listMyNotes = listMyNotes
exports.deleteNote = deleteNote
exports.updateNote = updateNote
exports.deleteNoteTag = deleteNoteTag
exports.addNoteTag = addNoteTag
exports.getNoteTags = getNoteTags
