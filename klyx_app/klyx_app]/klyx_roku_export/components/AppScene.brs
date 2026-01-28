sub init()
    m.top.backgroundUri = "pkg:/images/splash_hd.png"
    m.top.backgroundColor = "0x000000FF"
    
    ' DEBUG: Limpar auth para forçar login nos testes
    sec = CreateObject("roRegistrySection", "KLYX_AUTH")
    sec.Delete("user_email")
    sec.Flush()
    
    ' Check Auth Status
    checkAuth()
end sub

sub checkAuth()
    ' Ler do registro se já tem usuário
    sec = CreateObject("roRegistrySection", "KLYX_AUTH")
    if sec.Exists("user_email")
        ' Já logado -> Ir para Perfis
        showProfiles()
    else
        ' Não logado -> Ir para Login
        showLogin()
    end if
end sub

sub showLogin()
    m.loginScreen = CreateObject("roSGNode", "LoginScreen")
    m.loginScreen.observeField("authResult", "onLoginSuccess")
    m.top.appendChild(m.loginScreen)
    m.loginScreen.setFocus(true)
end sub

sub onLoginSuccess(event as Object)
    result = event.getData()
    if result.success
        ' Salvar no Registro
        sec = CreateObject("roRegistrySection", "KLYX_AUTH")
        sec.Write("user_email", result.user.email)
        sec.Write("user_data", FormatJson(result.user))
        sec.Flush()
        
        ' Remover tela de login
        m.top.removeChild(m.loginScreen)
        m.loginScreen = invalid
        
        ' Mostrar perfis
        showProfiles(result.user)
    end if
end sub

sub showProfiles(user = invalid as Object)
    ' Se user for null, tentar ler do registro
    if user = invalid
        sec = CreateObject("roRegistrySection", "KLYX_AUTH")
        jsonStr = sec.Read("user_data")
        if jsonStr <> ""
            user = ParseJson(jsonStr)
        end if
    end if

    if user = invalid
        ' Fallback para login se der erro
        showLogin()
        return
    end if

    m.profileScreen = CreateObject("roSGNode", "ProfileScreen")
    m.profileScreen.profiles = user.profiles
    m.profileScreen.observeField("selectedProfile", "onProfileSelected")
    m.top.appendChild(m.profileScreen)
    m.profileScreen.setFocus(true)
end sub

sub onProfileSelected(event as Object)
    profile = event.getData()
    print "Profile Selected: " + profile.name
    
    ' Remover tela de perfis
    m.top.removeChild(m.profileScreen)
    m.profileScreen = invalid
    
    ' Ir para Home
    showHome()
end sub

sub showHome()
    m.homeScene = CreateObject("roSGNode", "MainScene")
    m.top.appendChild(m.homeScene)
    m.homeScene.setFocus(true)
end sub
