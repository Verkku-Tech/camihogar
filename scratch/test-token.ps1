$key = [System.Text.Encoding]::UTF8.GetBytes("OrdinaSuperSecretKeyForDevelopmentMustBeAtLeast32CharsLong!")
$header = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}')).TrimEnd('=').Replace('+','-').Replace('/','_')
$payload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"nameid":"699651fc6616e0b31a158844","unique_name":"admin","role":"Super Administrator","iss":"OrdinaApi","aud":"OrdinaClients","nbf":1700000000,"exp":1999999999}')).TrimEnd('=').Replace('+','-').Replace('/','_')
$raw = "$header.$payload"
$hmac = [System.Security.Cryptography.HMACSHA256]::new($key)
$sig = [Convert]::ToBase64String($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($raw))).TrimEnd('=').Replace('+','-').Replace('/','_')
$jwt = "$raw.$sig"
$jwt | Out-File -FilePath "scratch/jwt.txt" -NoNewline
Write-Host "Generated JWT: $jwt"
