sub init()
    m.poster = m.top.findNode("poster")
    m.focusRing = m.top.findNode("focusRing")
end sub

sub itemContentChanged()
    itemContent = m.top.itemContent
    if itemContent <> invalid
        m.poster.uri = itemContent.hdPosterUrl
    end if
end sub

sub widthChanged()
    m.poster.width = m.top.width
    m.focusRing.width = m.top.width + 10
end sub

sub heightChanged()
    m.poster.height = m.top.height
    m.focusRing.height = m.top.height + 10
end sub

sub onFocusPercentChange()
    ' Quando o item ganha foco na RowList, o percentual muda
    percent = m.top.rowFocusPercent
    if percent > 0.9
        m.focusRing.visible = true
        m.poster.width = 210
        m.poster.height = 310
        m.poster.translation = "[-7, -7]"
    else
        m.focusRing.visible = false
        m.poster.width = 196
        m.poster.height = 294
        m.poster.translation = "[0, 0]"
    end if
end sub
