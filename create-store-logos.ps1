Add-Type -AssemblyName System.Drawing

# Dossier de sortie
New-Item -ItemType Directory -Force -Path assets | Out-Null

# Chargement du logo source
$src = [System.Drawing.Image]::FromFile("app-logo.png")

function Save-ResizedPng {
    param(
        [string]$Output,
        [int]$Width,
        [int]$Height
    )

    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)

    $g.Clear([System.Drawing.Color]::Transparent)

    $g.InterpolationMode =
        [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $g.SmoothingMode =
        [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $g.PixelOffsetMode =
        [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $g.DrawImage($src, 0, 0, $Width, $Height)

    $bmp.Save(
        $Output,
        [System.Drawing.Imaging.ImageFormat]::Png
    )

    $g.Dispose()
    $bmp.Dispose()
}

# Logos WACK
Save-ResizedPng "assets\Square150x150Logo.png" 150 150
Save-ResizedPng "assets\Wide310x150Logo.png" 310 150

# Logos complémentaires
Save-ResizedPng "assets\StoreLogo.png" 50 50
Save-ResizedPng "assets\Square44x44Logo.png" 44 44

$src.Dispose()

Write-Host ""
Write-Host "Logos générés avec succès."