sub init()
    m.avatar = m.top.findNode("avatar")
    m.name = m.top.findNode("name")
    m.focusRing = m.top.findNode("focusRing")
    m.bgColor = m.top.findNode("bgColor")
    m.initialsLabel = m.top.findNode("initialsLabel")
end sub

sub onContentChange()
    content = m.top.itemContent
    if content <> invalid
        m.name.text = content.title
        
        ' Check if image exists
        if content.hdPosterUrl <> "" and content.hdPosterUrl <> invalid
            m.avatar.uri = content.hdPosterUrl
            m.avatar.visible = true
            m.bgColor.visible = false
            m.initialsLabel.visible = false
        else
            ' Fallback to initials
            m.avatar.visible = false
            m.bgColor.visible = true
            m.initialsLabel.visible = true
            
            ' Initials
            if content.title <> ""
                m.initialsLabel.text = UCase(Left(content.title, 1))
            end if
            
            ' Deterministic Color
            colors = ["0x1F45FCFF", "0x2E8B57FF", "0xB22222FF", "0xDAA520FF", "0x800080FF"]
            ' Use simple hash of name length
            idx = 0
            if content.title <> invalid
                idx = Len(content.title) MOD 5
            end if
            m.bgColor.color = colors[idx]
        end if
    end if
end sub

sub onFocusPercentChange()
    percent = m.top.focusPercent
    if percent > 0.5
        m.focusRing.visible = true
        m.name.color = "0xFFFFFFFF"
        ' Scale effect
        m.bgColor.width = 190
        m.bgColor.height = 190
        m.bgColor.translation = "[5, 5]"
        m.initialsLabel.width = 190
        m.initialsLabel.height = 190
        m.initialsLabel.translation = "[5, 5]"
        m.avatar.width = 190
        m.avatar.height = 190
        m.avatar.translation = "[5, 5]"
    else
        m.focusRing.visible = false
        m.name.color = "0xAAAAAAFF"
        ' Reset scale
        m.bgColor.width = 180
        m.bgColor.height = 180
        m.bgColor.translation = "[10, 10]"
        m.initialsLabel.width = 180
        m.initialsLabel.height = 180
        m.initialsLabel.translation = "[10, 10]"
        m.avatar.width = 180
        m.avatar.height = 180
        m.avatar.translation = "[10, 10]"
    end if
end sub

sub onWidthChange()
end sub

sub onHeightChange()
end sub
