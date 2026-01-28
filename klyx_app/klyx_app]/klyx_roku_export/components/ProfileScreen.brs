sub init()
    m.grid = m.top.findNode("profileGrid")
    m.grid.observeField("itemSelected", "onItemSelected")
end sub

sub onProfilesChange()
    profiles = m.top.profiles
    if profiles <> invalid
        content = CreateObject("roSGNode", "ContentNode")
        
        ' Handle array or object (Firebase can return object for lists)
        items = []
        if type(profiles) = "roArray"
            items = profiles
        else if type(profiles) = "roAssociativeArray"
            for each key in profiles
                items.Push(profiles[key])
            end for
        end if
        
        for each p in items
            node = content.CreateChild("ContentNode")
            node.title = p.name
            
            ' Use provided avatar or empty for initials
            if p.avatar <> invalid and p.avatar <> "" and p.avatar <> "avatar1.png"
                 node.hdPosterUrl = p.avatar
            else
                 node.hdPosterUrl = "" 
            end if
            
            ' Store full profile data
            node.addField("profileData", "assocarray", false)
            node.profileData = p
        end for
        
        m.grid.content = content
        m.grid.setFocus(true)
    end if
end sub

sub onItemSelected()
    index = m.grid.itemSelected
    content = m.grid.content.GetChild(index)
    m.top.selectedProfile = content.profileData
end sub
