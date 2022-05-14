/* global CodeMirror, editor */
const wrapSymbols = ['*', '_', '~', '^', '+', '=']

/**
 * sort anchor and head by line and ch properties
 */
export const getStartAndEndRange = (selection) => {
  const { anchor, head } = selection
  let start = null
  let end = null
  if (anchor.line > head.line) {
    start = head
    end = anchor
  } else if (anchor.line < head.line) {
    start = anchor
    end = head
  } else {
    if (anchor.ch > head.ch) {
      start = head
      end = anchor
    } else {
      start = anchor
      end = head
    }
  }
  return { start, end }
}

export const toggleWrap = (cm, wrapper) => {
  const selections = cm.listSelections()
  selections.forEach((s) => {
    const { start, end } = getStartAndEndRange(s)
    const wrapStart = { line: start.line, ch: start.ch-2 }
    const wrapEnd = { line: end.line, ch: end.ch+2 }
    const wrapText = cm.getRange(wrapStart, wrapEnd)
    const startWrap = wrapText.slice(0, 2)
    const endWrap = wrapText.slice(-2)
    // if it's already wrapped, then remove it
    if (startWrap === wrapper && endWrap === wrapper) {
      const singleWrapper = Array.from(new Set(...[wrapper.split('')]))[0]
      const startReg = new RegExp(`^\\${singleWrapper}\\${singleWrapper}`)
      const endReg = new RegExp(`\\${singleWrapper}\\${singleWrapper}$`)
      console.log(startReg, endReg)
      cm.replaceRange(wrapText.replace(startReg, '').replace(endReg, ''), wrapStart, wrapEnd)
      if (start.line == end.line) {
        cm.setSelection({ line: start.line, ch: start.ch-2 }, { line: end.line, ch: end.ch-2 })
      } else {
        cm.setSelection({ line: start.line, ch: start.ch-2 }, { line: end.line, ch: end.ch })
      }
    } else {
      cm.replaceRange(`${wrapper}${cm.getRange(start, end)}${wrapper}`, start, end)
      if (start.line == end.line) {
        cm.setSelection({ line: start.line, ch: start.ch+2 }, { line: end.line, ch: end.ch+2 })
      } else {
        cm.setSelection({ line: start.line, ch: start.ch+2 }, { line: end.line, ch: end.ch })
      }
    }
  })
}


export function wrapTextWith (editor, cm, symbol) {
  if (!cm.getSelection()) {
    return CodeMirror.Pass
  } else {
    const ranges = cm.listSelections()
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      if (!range.empty()) {
        const from = range.from()
        const to = range.to()

        if (symbol !== 'Backspace') {
          const selection = cm.getRange(from, to)
          const anchorIndex = editor.indexFromPos(ranges[i].anchor)
          const headIndex = editor.indexFromPos(ranges[i].head)
          cm.replaceRange(symbol + selection + symbol, from, to, '+input')
          if (anchorIndex > headIndex) {
            ranges[i].anchor.ch += symbol.length
            ranges[i].head.ch += symbol.length
          } else {
            ranges[i].head.ch += symbol.length
            ranges[i].anchor.ch += symbol.length
          }
          cm.setSelections(ranges)
        } else {
          const preEndPos = {
            line: to.line,
            ch: to.ch + symbol.length
          }
          const preText = cm.getRange(to, preEndPos)
          const preIndex = wrapSymbols.indexOf(preText)
          const postEndPos = {
            line: from.line,
            ch: from.ch - symbol.length
          }
          const postText = cm.getRange(postEndPos, from)
          const postIndex = wrapSymbols.indexOf(postText)
          // check if surround symbol are list in array and matched
          if (preIndex > -1 && postIndex > -1 && preIndex === postIndex) {
            cm.replaceRange('', to, preEndPos, '+delete')
            cm.replaceRange('', postEndPos, from, '+delete')
          }
        }
      }
    }
  }
}

export function insertText (cm, text, cursorEnd = 0) {
  const cursor = cm.getCursor()
  cm.replaceSelection(text, cursor, cursor)
  cm.focus()
  cm.setCursor({ line: cursor.line, ch: cursor.ch + cursorEnd })
}

export function insertLink (cm, isImage) {
  const cursor = cm.getCursor()
  const ranges = cm.listSelections()
  const linkEnd = '](https://)'
  const symbol = (isImage) ? '![' : '['

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]
    if (!range.empty()) {
      const from = range.from()
      const to = range.to()
      const anchorIndex = editor.indexFromPos(ranges[i].anchor)
      const headIndex = editor.indexFromPos(ranges[i].head)
      let selection = cm.getRange(from, to)
      selection = symbol + selection + linkEnd
      cm.replaceRange(selection, from, to)
      if (anchorIndex > headIndex) {
        ranges[i].anchor.ch += symbol.length
        ranges[i].head.ch += symbol.length
      } else {
        ranges[i].head.ch += symbol.length
        ranges[i].anchor.ch += symbol.length
      }
      cm.setSelections(ranges)
    } else {
      cm.replaceRange(symbol + linkEnd, cursor, cursor)
      cm.setCursor({ line: cursor.line, ch: cursor.ch + symbol.length + linkEnd.length })
    }
  }
  cm.focus()
}

export function insertHeader (cm) {
  const cursor = cm.getCursor()
  const startOfLine = { line: cursor.line, ch: 0 }
  const startOfLineText = cm.getRange(startOfLine, { line: cursor.line, ch: 1 })
  // See if it is already a header
  if (startOfLineText === '#') {
    cm.replaceRange('#', startOfLine, startOfLine)
  } else {
    cm.replaceRange('# ', startOfLine, startOfLine)
  }
  cm.focus()
}

export function insertOnStartOfLines (cm, symbol) {
  const cursor = cm.getCursor()
  const ranges = cm.listSelections()

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]
    if (!range.empty()) {
      const from = range.from()
      const to = range.to()
      let selection = cm.getRange({ line: from.line, ch: 0 }, to)
      selection = selection.replace(/\n/g, '\n' + symbol)
      selection = symbol + selection
      cm.replaceRange(selection, from, to)
    } else {
      cm.replaceRange(symbol, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: 0 })
    }
  }
  cm.setCursor({ line: cursor.line, ch: cursor.ch + symbol.length })
  cm.focus()
}
