sub init()
    ' Referências aos Componentes
    m.menuList = m.top.findNode("menuList")
    m.rowList = m.top.findNode("mainRowList")
    m.videoPlayer = m.top.findNode("videoPlayer")
    m.loadingLabel = m.top.findNode("loadingLabel")
    m.sectionTitle = m.top.findNode("sectionTitle")
    m.apiTask = m.top.findNode("apiTask")
    
    ' Player UI References
    m.playerOverlay = m.top.findNode("playerOverlay")
    m.playerTitle = m.top.findNode("playerTitle")
    m.playerStatusLabel = m.top.findNode("playerStatusLabel")
    m.playerProgressBar = m.top.findNode("playerProgressBar")
    m.playerBufferedBar = m.top.findNode("playerBufferedBar")
    m.playerScrubberHead = m.top.findNode("playerScrubberHead")
    m.playerCurrentTime = m.top.findNode("playerCurrentTime")
    m.playerDuration = m.top.findNode("playerDuration")
    m.playerTimer = m.top.findNode("playerTimer")
    m.overlayTimer = m.top.findNode("overlayTimer")
    
    ' Hero References
    m.heroPoster = m.top.findNode("heroPoster")
    m.heroTitle = m.top.findNode("heroTitle")
    m.heroDescription = m.top.findNode("heroDescription")
    m.heroBackground = m.top.findNode("heroBackground")

    ' Configurar Menu Lateral
    setupMenu()

    ' Observadores
    m.menuList.observeField("itemSelected", "onMenuItemSelected")
    m.rowList.observeField("itemSelected", "onContentSelected")
    m.rowList.observeField("rowItemFocused", "onItemFocused") ' Para atualizar o Hero
    m.apiTask.observeField("content", "onContentLoaded")
    m.videoPlayer.observeField("state", "onVideoStateChanged")
    
    m.playerTimer.observeField("fire", "updatePlayerUI")
    m.overlayTimer.observeField("fire", "hidePlayerOverlay")
    
    ' Carregar Conteúdo Inicial (Home)
    loadHomeContent()
    
    ' Foco inicial no Menu
    m.menuList.setFocus(true)
end sub

sub setupMenu()
    content = CreateObject("roSGNode", "ContentNode")
    
    items = ["Início", "Filmes", "Séries", "Ao Vivo", "Buscar", "Sair"]
    
    for each item in items
        node = content.CreateChild("ContentNode")
        node.title = item
    end for
    
    m.menuList.content = content
end sub

sub loadHomeContent()
    m.loadingLabel.visible = true
    m.rowList.visible = false
    m.apiTask.control = "RUN"
end sub

sub onContentLoaded()
    m.loadingLabel.visible = false
    content = m.apiTask.content
    m.rowList.content = content
    m.rowList.visible = true
    
    ' Atualizar Hero com o primeiro item
    if content.GetChildCount() > 0
        firstRow = content.GetChild(0)
        if firstRow.GetChildCount() > 0
            updateHero(firstRow.GetChild(0))
        end if
    end if
end sub

sub onItemFocused()
    ' Quando o usuário navega na grade, atualizar o Hero
    row = m.rowList.rowItemFocused[0]
    col = m.rowList.rowItemFocused[1]
    
    if row <> invalid and col <> invalid
        content = m.rowList.content.GetChild(row).GetChild(col)
        updateHero(content)
    end if
end sub

sub updateHero(item as Object)
    if item <> invalid
        m.heroPoster.uri = item.hdPosterUrl
        m.heroTitle.text = item.title
        m.heroDescription.text = item.description
        m.heroBackground.uri = item.hdPosterUrl ' Background difuso
    end if
end sub

sub onMenuItemSelected()
    index = m.menuList.itemSelected
    item = m.menuList.content.GetChild(index)
    title = item.title
    
    m.sectionTitle.text = title
    
    if title = "Sair"
        sec = CreateObject("roRegistrySection", "KLYX_AUTH")
        sec.Delete("user_email")
        sec.Delete("user_data")
        sec.Flush()
        ' Reiniciar canal (hack simples para logout)
        m.top.getScene().close() 
    else
        m.rowList.setFocus(true)
    end if
end sub

sub onContentSelected()
    row = m.rowList.rowItemSelected[0]
    col = m.rowList.rowItemSelected[1]
    content = m.rowList.content.GetChild(row).GetChild(col)
    playVideo(content)
end sub

sub playVideo(content as Object)
    ' Configurar vídeo
    m.videoPlayer.content = content
    m.videoPlayer.visible = true
    m.videoPlayer.enableUI = false
    
    ' Set Title
    m.playerTitle.text = content.title
    
    ' Tentar forçar foco
    m.videoPlayer.setFocus(true)
    
    ' Iniciar
    m.videoPlayer.control = "play"
    
    ' Start Custom UI
    showPlayerOverlay()
    m.playerTimer.control = "start"
end sub

sub onVideoStateChanged()
    state = m.videoPlayer.state
    if state = "finished" or state = "error"
        m.videoPlayer.control = "stop"
        m.videoPlayer.visible = false
        m.playerOverlay.visible = false
        m.playerTimer.control = "stop"
        m.rowList.setFocus(true)
    else if state = "playing"
        m.playerStatusLabel.text = ""
    else if state = "buffering"
        m.playerStatusLabel.text = "Carregando..."
    end if
end sub

sub updatePlayerUI()
    if m.videoPlayer.state = "playing" or m.videoPlayer.state = "paused"
        position = m.videoPlayer.position
        duration = m.videoPlayer.duration
        
        if duration > 0
            width = 1820 ' Full width of progress bar background
            progress = (position / duration) * width
            m.playerProgressBar.width = progress
            m.playerScrubberHead.translation = [progress - 10, -5]
            
            m.playerCurrentTime.text = formatTime(position)
            m.playerDuration.text = formatTime(duration)
        end if
    end if
end sub

sub showPlayerOverlay()
    m.playerOverlay.visible = true
    m.overlayTimer.control = "start" ' Auto hide after 4s
    updatePlayerUI()
end sub

sub hidePlayerOverlay()
    if m.videoPlayer.state = "playing"
        m.playerOverlay.visible = false
    end if
end sub

function formatTime(seconds as Float) as String
    seconds = Int(seconds)
    hours = Int(seconds / 3600)
    minutes = Int((seconds Mod 3600) / 60)
    secs = seconds Mod 60
    
    if hours > 0
        return Str(hours).Trim() + ":" + Right("0" + Str(minutes).Trim(), 2) + ":" + Right("0" + Str(secs).Trim(), 2)
    else
        return Right("0" + Str(minutes).Trim(), 2) + ":" + Right("0" + Str(secs).Trim(), 2)
    end if
end function

function onKeyEvent(key as String, press as Boolean) as Boolean
    handled = false
    
    if press
        if m.videoPlayer.visible
            showPlayerOverlay()
            
            if key = "back"
                m.videoPlayer.control = "stop"
                m.videoPlayer.visible = false
                m.playerOverlay.visible = false
                m.playerTimer.control = "stop"
                m.rowList.setFocus(true)
                handled = true
            else if key = "play" or key = "OK"
                if m.videoPlayer.state = "playing"
                    m.videoPlayer.control = "pause"
                    m.playerStatusLabel.text = "II"
                    m.overlayTimer.control = "stop"
                else
                    m.videoPlayer.control = "resume"
                    m.playerStatusLabel.text = ""
                    m.overlayTimer.control = "start"
                end if
                handled = true
            else if key = "left"
                pos = m.videoPlayer.position - 10
                if pos < 0 then pos = 0
                m.videoPlayer.seek = pos
                handled = true
            else if key = "right"
                pos = m.videoPlayer.position + 10
                m.videoPlayer.seek = pos
                handled = true
            end if
        else 
            if key = "back"
                if m.rowList.hasFocus()
                    ' Voltar para o menu lateral
                    m.menuList.setFocus(true)
                    handled = true
                end if
            else if key = "right"
                if m.menuList.hasFocus()
                    m.rowList.setFocus(true)
                    handled = true
                end if
            else if key = "left"
                if m.rowList.hasFocus()
                    m.menuList.setFocus(true)
                    handled = true
                end if
            end if
        end if
    end if
    
    return handled
end function
