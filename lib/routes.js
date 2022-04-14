'use strict'

const { Router } = require('express')

const { wrap, urlencodedParser, markdownParser } = require('./utils')

// load controller
const indexController = require('./homepage')
const errorPageController = require('./errorPage')
const statusController = require('./status')
const historyController = require('./history')
const userController = require('./user')
const tagController = require('./tag')
const noteController = require('./note')
const response = require('./response')
const bodyParser = require('body-parser')
const appRouter = Router()

// register route

const csurf = require('csurf')
const csurfMiddleware = csurf({ cookie: true })

// get index
appRouter.get('/', csurfMiddleware, wrap(indexController.showIndex))

// ----- error page -----
// get 403 forbidden
appRouter.get('/403', errorPageController.errorForbidden)
// get 404 not found
appRouter.get('/404', errorPageController.errorNotFound)
// get 500 internal error
appRouter.get('/500', errorPageController.errorInternalError)

appRouter.get('/config', statusController.getConfig)

// register auth module
appRouter.use(require('./auth'))

// get history
appRouter.get('/history', historyController.historyGet)
// ! TODO: 不知道什么时候用
// post history
appRouter.post('/history', urlencodedParser, historyController.historyPost)
// post history by note id
// ! TODO: 不知道什么时候用
appRouter.post('/history/:noteId', urlencodedParser, historyController.historyPost)
// delete history
appRouter.delete('/history', historyController.historyDelete)
// ! TODO: 不知道什么时候用
// delete history by note id
appRouter.delete('/history/:noteId', historyController.historyDelete)

// user
// get me info
appRouter.get('/me', wrap(userController.getMe))
// delete the currently authenticated user
appRouter.get('/me/delete/:token?', wrap(userController.deleteUser))
// export the data of the authenticated user
appRouter.post('/me/export', urlencodedParser, csurfMiddleware, userController.exportMyData)
appRouter.get('/user/:username/avatar.svg', userController.getMyAvatar)
// register image upload module
appRouter.use(require('./imageRouter'))

// get new note
appRouter.get('/new', response.newNote)
// post new note with content
appRouter.post('/new', markdownParser, response.newNote)
// get publish note
appRouter.get('/s/:shortid', noteController.showPublishNote)
// publish note actions
appRouter.get('/s/:shortid/:action', response.publishNoteActions)
// get publish slide
appRouter.get('/p/:shortid', response.showPublishSlide)
// publish slide actions
appRouter.get('/p/:shortid/:action', response.publishSlideActions)
// gey my note list
appRouter.get('/api/notes/my_notes', noteController.listMyNotes)
// delete note by id
appRouter.delete('/api/notes/:noteId', noteController.deleteNote)
// update note content by id
appRouter.put('/api/notes/:noteId', bodyParser.json(), noteController.updateNote)

// delete note tag
appRouter.post('/api/notes/:noteId/del_tag', bodyParser.json(), noteController.deleteNoteTag)
// add note tag
appRouter.post('/api/notes/:noteId/add_tag', bodyParser.json(), noteController.addNoteTag)
// get note tag
appRouter.get('/api/notes/:noteId/get_tag', noteController.getNoteTags)

// tags
// add new tag
appRouter.put('/api/tag', bodyParser.json(), tagController.addTag)
// update tag
appRouter.post('/api/tag/:id', bodyParser.json(), tagController.updateTag)
// delete tag
appRouter.delete('/api/tag/:id', tagController.deleteTag)
// get all tags
appRouter.get('/api/tag', tagController.getTags)

// get note by id
appRouter.get('/:noteId', wrap(noteController.showNote))
// note actions
appRouter.get('/:noteId/:action', noteController.noteActions)
// note actions with action id
appRouter.get('/:noteId/:action/:actionId', noteController.noteActions)

exports.router = appRouter
