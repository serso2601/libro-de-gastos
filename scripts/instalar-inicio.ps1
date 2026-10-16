# Crea (o reemplaza) un acceso directo en la carpeta Inicio de Windows que corre iniciar.ps1 al
# iniciar sesión. Para quitarlo, borrar "Libro de Gastos.lnk" de esa carpeta (Win+R, shell:startup).

$inicio = [Environment]::GetFolderPath('Startup')
$acceso = Join-Path $inicio 'Libro de Gastos.lnk'
$script = Join-Path $PSScriptRoot 'iniciar.ps1'

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($acceso)
$lnk.TargetPath = (Get-Command powershell.exe).Source
$lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.WindowStyle = 7  # minimizada
$lnk.Description = 'Arranca el servidor del Libro de Gastos'
$lnk.Save()

# Un acceso en el escritorio a la página de estado, para ver si el servidor está activo.
$estado = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Estado Libro de Gastos.url'
Set-Content -Path $estado -Value "[InternetShortcut]`r`nURL=http://127.0.0.1:8766/" -Encoding ascii

Write-Output "Listo: $acceso"
Write-Output "Listo: $estado"
