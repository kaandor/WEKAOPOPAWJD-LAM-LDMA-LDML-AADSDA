sub init()
    m.emailBtn = m.top.findNode("emailButton")
    m.passBtn = m.top.findNode("passwordButton")
    m.showPassBtn = m.top.findNode("showPasswordButton")
    m.loginBtn = m.top.findNode("loginButton")
    m.guestBtn = m.top.findNode("guestButton")
    m.statusLabel = m.top.findNode("statusLabel")
    m.keyboard = m.top.findNode("keyboard")
    
    ' Visual Elements
    m.emailBg = m.top.findNode("emailBg")
    m.emailLabel = m.top.findNode("emailLabel")
    m.passBg = m.top.findNode("passBg")
    m.passLabel = m.top.findNode("passLabel")
    m.loginBg = m.top.findNode("loginBg")
    m.loginLabel = m.top.findNode("loginLabel")
    m.guestBg = m.top.findNode("guestBg")
    m.guestLabel = m.top.findNode("guestLabel")
    
    m.email = ""
    m.password = ""
    m.isPasswordVisible = false
    m.editingField = "" 
    
    ' Observers
    m.emailBtn.observeField("buttonSelected", "onEmailClick")
    m.passBtn.observeField("buttonSelected", "onPassClick")
    m.showPassBtn.observeField("buttonSelected", "onShowPassClick")
    m.loginBtn.observeField("buttonSelected", "onLoginClick")
    m.guestBtn.observeField("buttonSelected", "onGuestClick")
    m.keyboard.observeField("text", "onKeyboardText")
    m.keyboard.observeField("buttonSelected", "onKeyboardAction")
    
    ' Initial Focus
    m.emailBtn.setFocus(true)
    updateVisuals()
end sub

sub updateVisuals()
    ' Colors
    c_bg_idle = "0x262626FF"
    c_bg_focus = "0x333333FF" ' Slightly lighter
    c_border_focus = "0x6F42C1FF" ' Purple
    
    ' Email State
    if m.emailBtn.hasFocus()
        m.emailBg.color = c_bg_focus
        ' Simulate border by scaling or using another rect (simple color change for now)
        ' For high fidelity, we'd add a border rectangle, but let's just brighten the BG
        m.emailLabel.color = "0xFFFFFFFF"
    else
        m.emailBg.color = c_bg_idle
        if m.email = "" 
            m.emailLabel.color = "0x888888FF"
        else
            m.emailLabel.color = "0xCCCCCCFF"
        end if
    end if
    
    ' Password State
    if m.passBtn.hasFocus()
        m.passBg.color = c_bg_focus
        m.passLabel.color = "0xFFFFFFFF"
    else
        m.passBg.color = c_bg_idle
        if m.password = ""
            m.passLabel.color = "0x888888FF"
        else
            m.passLabel.color = "0xCCCCCCFF"
        end if
    end if
    
    ' Login Button State
    if m.loginBtn.hasFocus()
        m.loginBg.color = "0x805AD5FF" ' Lighter Purple
    else
        m.loginBg.color = "0x6F42C1FF" ' Klyx Purple
    end if
    
    ' Guest Button State
    if m.guestBtn.hasFocus()
        m.guestLabel.color = "0xFFFFFFFF"
    else
        m.guestLabel.color = "0xAAAAAAFF"
    end if
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    handled = false
    if press
        if key = "down"
            if m.emailBtn.hasFocus()
                m.passBtn.setFocus(true)
                handled = true
            else if m.passBtn.hasFocus()
                m.showPassBtn.setFocus(true)
                handled = true
            else if m.showPassBtn.hasFocus()
                m.loginBtn.setFocus(true)
                handled = true
            else if m.loginBtn.hasFocus()
                m.guestBtn.setFocus(true)
                handled = true
            end if
        else if key = "up"
            if m.guestBtn.hasFocus()
                m.loginBtn.setFocus(true)
                handled = true
            else if m.loginBtn.hasFocus()
                m.showPassBtn.setFocus(true)
                handled = true
            else if m.showPassBtn.hasFocus()
                m.passBtn.setFocus(true)
                handled = true
            else if m.passBtn.hasFocus()
                m.emailBtn.setFocus(true)
                handled = true
            end if
        end if
        
        updateVisuals()
    end if
    return handled
end function

sub onEmailClick()
    m.editingField = "email"
    m.keyboard.title = "Digite seu Email"
    m.keyboard.text = m.email
    m.keyboard.secureTextEntry = false
    m.keyboard.visible = true
    m.keyboard.setFocus(true)
end sub

sub onPassClick()
    m.editingField = "password"
    m.keyboard.title = "Digite sua Senha"
    m.keyboard.text = m.password
    m.keyboard.secureTextEntry = not m.isPasswordVisible
    m.keyboard.visible = true
    m.keyboard.setFocus(true)
end sub

sub onShowPassClick()
    m.isPasswordVisible = not m.isPasswordVisible
    if m.isPasswordVisible
        m.showPassBtn.text = "[X] Mostrar Senha"
        updatePassLabel()
    else
        m.showPassBtn.text = "[ ] Mostrar Senha"
        updatePassLabel()
    end if
end sub

sub onKeyboardText()
    if m.editingField = "email"
        m.email = m.keyboard.text
        if m.email <> ""
            m.emailLabel.text = m.email
        else
            m.emailLabel.text = "Digite seu email"
        end if
    else if m.editingField = "password"
        m.password = m.keyboard.text
        updatePassLabel()
    end if
    updateVisuals()
end sub

sub updatePassLabel()
    if m.password = ""
        m.passLabel.text = "Digite sua senha"
    else
        if m.isPasswordVisible
            m.passLabel.text = m.password
        else
            ' Create asterisks string
            stars = ""
            for i = 1 to Len(m.password)
                stars = stars + "*"
            end for
            m.passLabel.text = stars
        end if
    end if
end sub

sub onKeyboardAction()
    m.keyboard.visible = false
    if m.editingField = "email"
        m.passBtn.setFocus(true)
    else
        m.loginBtn.setFocus(true)
    end if
    updateVisuals()
end sub

sub onLoginClick()
    if m.email = "" or m.password = ""
        m.statusLabel.text = "Preencha email e senha"
        return
    end if
    
    m.statusLabel.text = "Autenticando..."
    m.loginTask = CreateObject("roSGNode", "AuthTask")
    m.loginTask.email = m.email
    m.loginTask.password = m.password
    m.loginTask.observeField("result", "onLoginResult")
    m.loginTask.control = "RUN"
end sub

sub onLoginResult()
    result = m.loginTask.result
    if result.success
        m.statusLabel.color = "0x00FF00FF"
        m.statusLabel.text = "Sucesso!"
        m.top.authResult = result
    else
        m.statusLabel.color = "0xFF0000FF"
        m.statusLabel.text = result.error
    end if
end sub

sub onGuestClick()
    guestUser = {
        id: "guest",
        email: "guest@klyx.app",
        display_name: "Visitante",
        profiles: {
            p1: { id: "p1", name: "Visitante", avatar: "avatar1.png" }
        }
    }
    m.top.authResult = { success: true, user: guestUser }
end sub
