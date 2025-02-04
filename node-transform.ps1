#Requires -Version 6.0

Param(
  [Parameter(Mandatory = $false, Position = 0)]
  [string] $Version
)

If ((Get-Location).Path -notlike '*tpy') {
  Write-Error "Not in project root"
  Exit
}

# Injection

$ItemList = "src", "README.md", "LICENSE", "mod.ts"
$DeleteList = "lib", "node_modules", "package-lock.json", "mod.js", "mod.d.ts"
$Destination = "node"
$NodePackageLocation = "$Destination/package.json"
$ImportRegex = "(?<=(?<=\n|^)import(?:(?!(\.d)?\.ts).|\n)*)(\.d)?\.ts"

[string[]]$PresentFiles = @()
$ItemList + $DeleteList | ForEach-Object {
  $F = "$Destination/$_"
  If (Test-Path $F) {
    $PresentFiles += $F
  }
}

$PresentFilesFormated = [String]::Join(", ", $PresentFiles)

If ($PresentFiles.Length -ne 0) {
  $decision = $Host.UI.PromptForChoice(
    "Item(s) in the specified destination location already exists. ($PresentFilesFormated)",
    "Do you want to delete these items and continue?",
    ('&Yes', '&No'), 1)
  If (($decision -eq 0) -or ($null -ne $env:CI)) {
    $PresentFiles | Remove-Item -Recurse -Force
  }
  Else {
    Exit
  }
}

ForEach ($Item in $ItemList) {
  If (Test-Path $Item -PathType Container) {
    Copy-Item "$Item" "$Destination" -Recurse
  }
  Else {
    Copy-Item "$Item" "$Destination"
  }
}

# Package Setup

$NodePackage = (Get-Content "$NodePackageLocation" -Raw | ConvertFrom-Json)
$NodePackage.version = $Version
$NodePackage | ConvertTo-Json > $NodePackageLocation

# Node Import Syntax Fix

Get-ChildItem $Destination -Recurse -Filter *.ts | ForEach-Object {
  $Content = Get-Content $_.FullName -Raw
  $Content -replace "$ImportRegex", "" > $_.FullName
}

# Verification

Set-Location "$Destination"

npm install -Wait
npm run build -Wait

Copy-Item -Recurse "src/types" "lib"

"mod.d.ts", "mod.js" | ForEach-Object {
  $K = "$(Get-Content "$_" -Raw)" -replace "src", "lib"
  "$K" > "$_"
}

Set-Location ".."