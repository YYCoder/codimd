/* eslint-env browser, jquery */
/* global moment, serverurl */
/**
 * index page {笔记} tab logics
 *  * rely on the initialization of window.tags in {cover.js}
 */

const NOTE_TEMPLATE = `<li class="col-xs-12 col-sm-6 col-md-6 col-lg-4">
 <span class="id" style="display:none;">{{alias}}</span>
 <a href="#">
   <div class="item">
     <div class="content">
       <h4 class="text">{{title}}</h4>
       <p>
         <i class="time">修改时间：{{lastchangeAt}}</i>
       </p>
       <p class="tags">{{tags}}</p>
     </div>
     <div class="side">
       <p>权限：{{permission}}，浏览量：{{viewcount}}</p>
     </div>
   </div>
 </a>
</li>`
const NO_NOTE_TEMPLATE = `<h4 class="ui-nonotes">
暂无文档......
</h4>`
let curPage = 1
const LIMIT = 20
const $pg = $('#notes-pagination')
// 分页配置
const pgOpts = {
  totalPages: 1,
  initiateStartPageClick: false,
  // visiblePages,
  onPageClick: function (event, page) {
    curPage = page
    fetchNotes()
  }
}

export const fetchNotes = async () => {
  const tags = $('.notes-tags').select2('data')
  const keyword = $('#notes .notes-search').val()
  const orderClass = $('#notes .notes-sort').attr('class').split(' ')
  const order = orderClass.some(c => c === 'asc') ? 'ASC' :
    orderClass.some(c => c === 'desc') ? 'DESC' : ''
  const orderQuery = order ? `&orderBy=lastchangeAt&order=${order}` : ''
  const tagIds = tags.reduce((res, cur) => {
    return `${res}&tagIds=${cur.id}`
  }, '')

  fetch(`/api/notes/my_notes?page=${curPage-1}&limit=${LIMIT}&name=${keyword}&keyword=${keyword}${tagIds}${orderQuery}`)
    .then(res => res.json())
    .then(data => {
      console.log('=====', data)
      const { total, myNotes } = data
      const totalPages = Math.floor(total / LIMIT) + (total % LIMIT > 0 ? 1 : 0)
      $pg.twbsPagination('destroy')

      $pg.twbsPagination($.extend({}, pgOpts, {
        startPage: curPage,
        totalPages: totalPages === 0 ? 1 : totalPages
      }))

      const $list = $('#notes-list')
      // clear all children elements
      $list.empty()
      if (total === 0) {
        $list.append(NO_NOTE_TEMPLATE)
        return
      }
      myNotes.forEach((note) => {
        const noteItem = $(NOTE_TEMPLATE.replace(/{{(\w+)}}/g, (_, field) => {
          if (field === 'tags') {
            return note.tags.map((t) => `<span>${t.name}</span>`)
          }
          if (field === 'viewcount') {
            return note[field]
          }
          if (field === 'alias') {
            return note[field] || note.id
          }
          return note[field] || '暂无'
        })).on('click', function() {
          const id = $(this).find('span.id').text()
          window.open(`/${id}`, '_blank')
        })
        $list.append(noteItem)
      })
      
    })
    .catch(err => {
      console.error(err)
    })
}

$('.notes-tags').select2({
  placeholder: $('.notes-tags').attr('placeholder'),
  multiple: true,
  data() {
    return {
      results: window.tags
    }
  }
})
$('.select2-input').css('width', 'inherit')
$('.notes-tags').on('change', () => {
  curPage = 1
  fetchNotes()
})

$('#notes .notes-sort').on('click', function() {
  const $this = $(this)
  if ($this.hasClass('asc')) {
    $this.removeClass('asc')
    $this.addClass('desc')
  } else if ($this.hasClass('desc')) {
    $this.removeClass('desc')
  } else {
    $this.addClass('asc')
  }
  fetchNotes()
})

$('#notes .ui-refresh-notes').on('click', fetchNotes)

let timer = null
$('#notes .notes-search').on('change', () => {
  clearTimeout(timer)
  timer = setTimeout(fetchNotes, 500)
})