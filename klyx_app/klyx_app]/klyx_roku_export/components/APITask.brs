sub init()
    m.top.functionName = "loadContent"
end sub

sub loadContent()
    print "APITask: Loading content..."
    
    ' Fetch Home Catalog from Firebase
    url = "https://klix-iptv-default-rtdb.firebaseio.com/catalog/home.json"
    request = CreateObject("roUrlTransfer")
    request.SetCertificatesFile("common:/certs/ca-bundle.crt")
    request.InitClientCertificates()
    request.SetUrl(url)
    
    response = request.GetToString()
    
    if response <> ""
        json = ParseJson(response)
        if json <> invalid and json.rails <> invalid
            rootContent = CreateObject("roSGNode", "ContentNode")
            
            ' Iterate over rails
            for each key in json.rails
                railData = json.rails[key]
                if railData <> invalid and railData.Count() > 0
                    rowNode = rootContent.CreateChild("ContentNode")
                    rowNode.title = key ' Use key as title for now (e.g. "popular", "trending")
                    
                    for each item in railData
                        itemNode = rowNode.CreateChild("ContentNode")
                        itemNode.title = item.title
                        itemNode.ShortDescriptionLine1 = item.title
                        itemNode.ShortDescriptionLine2 = item.description
                        
                        ' Handle Poster URLs (Relative vs Absolute)
                        posterUrl = item.poster_url
                        if posterUrl <> invalid
                            itemNode.hdPosterUrl = GetFullUrl(posterUrl)
                            itemNode.sdPosterUrl = GetFullUrl(posterUrl)
                        end if
                        
                        itemNode.Description = item.description
                        itemNode.url = item.stream_url
                        itemNode.streamFormat = "mp4" ' Default
                        
                        ' Basic check for HLS
                        if item.stream_url <> invalid and item.stream_url.InStr(".m3u8") > 0
                             itemNode.streamFormat = "hls"
                        end if
                    end for
                end if
            end for
            
            m.top.content = rootContent
        else
            print "APITask: Invalid JSON or no rails"
        end if
    else
        print "APITask: Failed to fetch URL"
    end if
end sub

function GetFullUrl(url as String) as String
    if url = invalid or url = "" return ""
    
    ' If it starts with http, it is absolute
    if url.Left(4) = "http" return url
    
    ' If it starts with ./ or /, it is relative
    ' Base URL assumed to be the GitHub Pages repo (adjust if needed)
    baseUrl = "https://kaandrobecker.github.io/klyx_app"
    
    if url.Left(2) = "./"
        return baseUrl + url.Mid(1) ' Remove . keep /
    else if url.Left(1) = "/"
        return baseUrl + url
    else
        return baseUrl + "/" + url
    end if
end function
