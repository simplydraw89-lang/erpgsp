param([string]$ImagePath = $env:GSP_OCR_FILE)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapTransform,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfPageRenderOptions,Windows.Data.Pdf,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
function Await-WinRT($Operation, [Type]$ResultType) {
  if ($null -eq $ResultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
    $task = $method.Invoke($null, @($Operation))
  } else {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  }
  $task.Wait()
  if ($null -ne $ResultType) { return $task.Result }
}
function Read-Ocr($stream) {
  $decoder = Await-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $transform = [Windows.Graphics.Imaging.BitmapTransform]::new()
  $scale = [Math]::Min(1, 3800 / [Math]::Max($decoder.PixelWidth, $decoder.PixelHeight))
  $transform.ScaledWidth = [Math]::Max(1, [Math]::Floor($decoder.PixelWidth * $scale))
  $transform.ScaledHeight = [Math]::Max(1, [Math]::Floor($decoder.PixelHeight * $scale))
  $bitmap = Await-WinRT ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore, $transform, [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
  try {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine) { throw 'Bahasa OCR Windows belum tersedia. Masukkan data manual.' }
    $result = Await-WinRT ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    # Rebuild visual table rows instead of reading each column down the page.
    $words = @($result.Lines | ForEach-Object { $_.Words } | Sort-Object { $_.BoundingRect.Y + $_.BoundingRect.Height / 2 })
    $rows = [System.Collections.Generic.List[object]]::new()
    foreach ($word in $words) {
      $center = $word.BoundingRect.Y + $word.BoundingRect.Height / 2
      $row = if ($rows.Count -gt 0) { $rows[$rows.Count - 1] } else { $null }
      if ($null -eq $row -or [Math]::Abs($row.Y - $center) -gt [Math]::Max(4, [Math]::Min($row.Height, $word.BoundingRect.Height) * 0.65)) {
        $row = @{ Y = $center; Height = $word.BoundingRect.Height; Words = [System.Collections.Generic.List[object]]::new() }
        $rows.Add($row)
      }
      $row.Words.Add($word)
    }
    return (($rows | ForEach-Object { ($_.Words | Sort-Object { $_.BoundingRect.X } | ForEach-Object { $_.Text }) -join ' ' }) -join "`n")
  } finally { $bitmap.Dispose() }
}
$file = Await-WinRT ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
$texts = @()
if ([System.IO.Path]::GetExtension($ImagePath) -eq '.pdf') {
  $pdf = Await-WinRT ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
  if ($pdf.PageCount -gt 5) { throw 'PDF OCR dibatasi maksimal 5 halaman. Unggah dokumen ringkas atau isi data manual.' }
  for ($index = 0; $index -lt $pdf.PageCount; $index++) {
    $page = $pdf.GetPage($index)
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    try {
      $options = [Windows.Data.Pdf.PdfPageRenderOptions]::new()
      $options.DestinationWidth = [Math]::Min(2800, [Math]::Floor(3800 * $page.Size.Width / $page.Size.Height))
      Await-WinRT ($page.RenderToStreamAsync($stream, $options)) $null
      $stream.Seek(0)
      $texts += Read-Ocr $stream
    } finally { $page.Dispose(); $stream.Dispose() }
  }
} else {
  $stream = Await-WinRT ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try { $texts += Read-Ocr $stream } finally { $stream.Dispose() }
}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
@{'text' = ($texts -join "`n`n")} | ConvertTo-Json -Compress
