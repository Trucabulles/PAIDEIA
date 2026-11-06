param(
    [Parameter(Mandatory = $true)]
    [string]$StopFile,
    [string]$InterfaceName = "Wi-Fi",
    [string]$UploadDirectory = "$env:APPDATA\com.paideia.app\collaboration\uploads"
)

$initial = Get-NetAdapterStatistics -Name $InterfaceName
$previous = $initial
$startedAt = Get-Date
$samples = [System.Collections.Generic.List[object]]::new()
$maximumPackageBytes = 0L
$packageFirstSeenAt = $null
$packageMaximumSeenAt = $null

Write-Output ("MONITOR_START " + ([pscustomobject]@{
    Start = $startedAt.ToString("o")
    StopFile = $StopFile
    Interface = $InterfaceName
    LinkSpeed = (Get-NetAdapter -Name $InterfaceName).LinkSpeed
} | ConvertTo-Json -Compress))

while (-not (Test-Path -LiteralPath $StopFile)) {
    Start-Sleep -Seconds 1
    $now = Get-Date
    $current = Get-NetAdapterStatistics -Name $InterfaceName
    $sentMbps = [math]::Max(0, ($current.SentBytes - $previous.SentBytes) * 8 / 1e6)
    $receivedMbps = [math]::Max(0, ($current.ReceivedBytes - $previous.ReceivedBytes) * 8 / 1e6)
    $samples.Add([pscustomobject]@{
        SentMbps = $sentMbps
        ReceivedMbps = $receivedMbps
    })
    $previous = $current

    if (Test-Path -LiteralPath $UploadDirectory) {
        foreach ($file in Get-ChildItem -LiteralPath $UploadDirectory -File -ErrorAction SilentlyContinue) {
            if ($null -eq $packageFirstSeenAt) {
                $packageFirstSeenAt = $now
            }
            if ($file.Length -gt $maximumPackageBytes) {
                $maximumPackageBytes = $file.Length
                $packageMaximumSeenAt = $now
            }
        }
    }
}

$endedAt = Get-Date
$final = Get-NetAdapterStatistics -Name $InterfaceName
$durationSeconds = ($endedAt - $startedAt).TotalSeconds
$sentBytes = $final.SentBytes - $initial.SentBytes
$receivedBytes = $final.ReceivedBytes - $initial.ReceivedBytes

$summary = [pscustomobject]@{
    Start = $startedAt.ToString("o")
    End = $endedAt.ToString("o")
    DurationSeconds = [math]::Round($durationSeconds, 3)
    Interface = $InterfaceName
    LinkSpeed = (Get-NetAdapter -Name $InterfaceName).LinkSpeed
    SentBytes = $sentBytes
    ReceivedBytes = $receivedBytes
    AverageSentMbps = [math]::Round($sentBytes * 8 / $durationSeconds / 1e6, 3)
    AverageReceivedMbps = [math]::Round($receivedBytes * 8 / $durationSeconds / 1e6, 3)
    PeakSentMbps = [math]::Round(($samples.SentMbps | Measure-Object -Maximum).Maximum, 3)
    PeakReceivedMbps = [math]::Round(($samples.ReceivedMbps | Measure-Object -Maximum).Maximum, 3)
    PackageMaxBytes = $maximumPackageBytes
    PackageFirstSeen = if ($packageFirstSeenAt) { $packageFirstSeenAt.ToString("o") } else { $null }
    PackageMaxAt = if ($packageMaximumSeenAt) { $packageMaximumSeenAt.ToString("o") } else { $null }
    Samples = $samples.Count
}

Write-Output ("MONITOR_SUMMARY " + ($summary | ConvertTo-Json -Compress))
