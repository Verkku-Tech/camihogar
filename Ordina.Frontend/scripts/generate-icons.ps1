Add-Type -AssemblyName System.Drawing
$srcPath = 'C:\Users\Saydenier\.gemini\antigravity-ide\brain\90b27ed9-e0dc-4e16-8dc6-cd7d8cc672da\.user_uploaded\media_1789965815941.png'
$publicDir = 'Ordina.Frontend\public'
Copy-Item $srcPath (Join-Path $publicDir 'icon.png') -Force

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($img, $width, $height, $outPath) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $scale = [Math]::Min($width / $img.Width, $height / $img.Height)
    $destW = [int]($img.Width * $scale)
    $destH = [int]($img.Height * $scale)
    $destX = [int](($width - $destW) / 2)
    $destY = [int](($height - $destH) / 2)
    
    $g.DrawImage($img, $destX, $destY, $destW, $destH)
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Resize-Image $srcImg 192 192 (Join-Path $publicDir 'icon-192.png')
Resize-Image $srcImg 512 512 (Join-Path $publicDir 'icon-512.png')
Resize-Image $srcImg 180 180 (Join-Path $publicDir 'apple-touch-icon.png')
Resize-Image $srcImg 64 64 (Join-Path $publicDir 'favicon.png')

$srcImg.Dispose()
Write-Host 'Icons generated successfully'
