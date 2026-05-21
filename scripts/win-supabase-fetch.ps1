param(
  [Parameter(Mandatory = $true)]
  [string]$RequestPath
)

$ErrorActionPreference = "Stop"

function Write-ResponseJson {
  param(
    [int]$Status,
    [hashtable]$Headers,
    [string]$Body
  )
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Body))
  [PSCustomObject]@{
    ok      = $true
    status  = $Status
    headers = $Headers
    body    = $encoded
  } | ConvertTo-Json -Compress -Depth 6
}

function Read-ErrorBody {
  param($WebResponse)
  try {
    $stream = $WebResponse.GetResponseStream()
    if (-not $stream) { return "" }
    $reader = New-Object System.IO.StreamReader($stream)
    return $reader.ReadToEnd()
  } catch {
    return ""
  }
}

function Headers-FromWebResponse {
  param($Response)
  $out = @{}
  if ($null -eq $Response -or $null -eq $Response.Headers) { return $out }
  foreach ($key in $Response.Headers.AllKeys) {
    $out[$key] = ($Response.Headers[$key] -join ", ")
  }
  return $out
}

try {
  $req = Get-Content -Path $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  [Net.ServicePointManager]::Expect100Continue = $false

  $method = [string]$req.method
  $uri = [string]$req.url
  $http = [System.Net.HttpWebRequest]::Create($uri)
  $http.Method = $method
  $http.KeepAlive = $false
  $http.Timeout = 60000
  $http.ReadWriteTimeout = 60000
  $http.AllowAutoRedirect = $true

  if ($req.headers) {
    $req.headers.PSObject.Properties | ForEach-Object {
      $name = [string]$_.Name
      $value = [string]$_.Value
      if ($name -ieq "Connection") { return }
      $http.Headers[$name] = $value
    }
  }

  if ($req.body -and $method -notin @("GET", "HEAD")) {
    $bytes = [Text.Encoding]::UTF8.GetBytes([string]$req.body)
    $http.ContentLength64 = $bytes.Length
    if ($req.contentType) {
      $http.ContentType = [string]$req.contentType
    }
    $stream = $http.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
  }

  try {
    $response = $http.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $body = $reader.ReadToEnd()
    $reader.Close()
    $response.Close()
    Write-ResponseJson -Status ([int]$response.StatusCode) -Headers (Headers-FromWebResponse $response) -Body $body
  } catch [System.Net.WebException] {
    $web = $_.Exception.Response
    if ($web) {
      $status = [int]$web.StatusCode
      $body = Read-ErrorBody $web
      Write-ResponseJson -Status $status -Headers (Headers-FromWebResponse $web) -Body $body
    } else {
      throw
    }
  }
} catch {
  [PSCustomObject]@{
    ok    = $false
    error = $_.Exception.Message
  } | ConvertTo-Json -Compress
  exit 1
}
