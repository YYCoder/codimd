require('../css/tags.css')


export function initTags({
    selector = '',
    allData = [],
    initData = [],
    search = (query, allData) => {},
    onPressEnter = (val) => {},
    onSelect = (val, text) => true,
    onDelete = (val, text) => true,
} = {}) {
    function _add_input_tag(el, value, text) {
        let template=`<span class="tag">
            <span class="text" _value="${value}">${text}</span>
            <span class="close">&times;</span>
        </span>\n`
        $(el).parents().eq(2).find('.data').append(template);
        $(el).val('')
    }

    initData.forEach(item => {
        _add_input_tag($(`${selector} input`), item.id, item.name)
    })
    
    const $dom = $(selector)
    /*
    Handle click of the input area
    */
    $dom.click(function () {
        $(this).find('input').focus()
    })

    /*
    handle the click of close button on the tags
    */
    $(document).on("click", `${selector} .data .tag .close`, async function() {
        if (onDelete) {
            const $tag = $(this).siblings('.text')
            const value = $tag.attr('_value')
            const text = $tag.text()
            if (await onDelete(value, text)) {
                $(this).parent().remove()
            }
        } else {
            $(this).parent().remove()
        }
    })

    /*
    Handle the click of one suggestion
    */
    $(document).on("click", `${selector} .autocomplete-items div`, async function() {
        const data_holder = $(this).parents().eq(4).find('.data')
        const value = $(this).attr('_value')
        const text = $(this).text()
        if ((onSelect && (await onSelect(value, text))) || !onSelect) {
            _add_input_tag(data_holder, value, text)
            $(`${selector} .autocomplete-items`).html('')
        }
    })

    /*
    detect enter on the input
    */
    $(`${selector} input`).on("keydown", async function (event) {
        if (event.which == 13 && onPressEnter) {
            let data = $(this).val()
            const item = await onPressEnter(data)
            if (item) {
                const { value, text } = item
                _add_input_tag(this, value, text)
            }
            $(`${selector} input`).focusout()
        }
    });

    $(`${selector} input`).on("focusout", function () {
        $(this).val('')
        var that = this;
        setTimeout(() => {
            $(that).parents().eq(2).find('.autocomplete .autocomplete-items').html('')
        }, 200);
    });

    $(`${selector} input`).on("keyup", function (event) {
        var query = $(this).val()

        if (event.which == 8) {
            if (query == "") {
                $(`${selector} .autocomplete-items`).html('')
                return;
            }
        }
        $(`${selector} .autocomplete-items`).html('')
        const filtered = search(query, allData)
        let sug_area = $(this).parents().eq(2).find('.autocomplete .autocomplete-items')
        filtered.forEach(t => {
          let template = $(`<div _value="${t.id}">${t.name}</div>`).hide()
          sug_area.append(template)
          template.show()
        })
    });
}
/*
create a chainnable method for the script to
*/
$.fn.tagsValues = function (/*, args*/) {
    //loop through all tags getting the attribute value
    const data = []
    $(this).find(".data .tag .text").each(function (key, value) {
        let v = $(value).attr('_value')
        let t = $(value).text()
        data.push({ value: v, text: t })
    })

    return data
};

