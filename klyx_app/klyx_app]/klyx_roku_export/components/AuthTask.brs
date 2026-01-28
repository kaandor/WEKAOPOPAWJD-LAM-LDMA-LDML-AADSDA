sub init()
    m.top.functionName = "executeAuth"
end sub

sub executeAuth()
    email = m.top.email
    password = m.top.password
    
    ' Validate inputs
    if email = invalid or email = "" or password = invalid or password = ""
        m.top.result = { success: false, error: "Email ou senha vazios" }
        return
    end if
    
    ' Format email key (replace . with , and @ with _at_)
    ' Roku BrightScript doesn't have Regex replace, so we use string manipulation helper
    emailKey = escapeEmail(email)
    
    ' URL to fetch user data
    url = "https://klix-iptv-default-rtdb.firebaseio.com/users/" + emailKey + ".json"
    
    request = CreateObject("roUrlTransfer")
    request.SetCertificatesFile("common:/certs/ca-bundle.crt")
    request.InitClientCertificates()
    request.SetUrl(url)
    
    response = request.GetToString()
    
    if response <> "" and response <> "null"
        user = ParseJson(response)
        
        if user <> invalid and user.password = password
            ' Success!
            m.top.result = { 
                success: true, 
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.display_name,
                    profiles: user.profiles
                }
            }
        else
            m.top.result = { success: false, error: "Senha incorreta" }
        end if
    else
        m.top.result = { success: false, error: "Usuário não encontrado" }
    end if
end sub

function escapeEmail(email as String) as String
    res = ""
    for i = 0 to Len(email) - 1
        char = email.Mid(i, 1)
        if char = "."
            res = res + ","
        else if char = "@"
            res = res + "_at_"
        else
            res = res + char
        end if
    end for
    return res
end function
