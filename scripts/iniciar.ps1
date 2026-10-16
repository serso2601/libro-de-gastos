# Arranca el servidor del Libro de Gastos en segundo plano, sin ventana.
#
# Pensado para correr solo al iniciar sesión en Windows (un acceso directo en la carpeta Inicio,
# ver instalar-inicio.ps1). Si ya está corriendo, no lo arranca de nuevo.
# El servidor escucha solo en la PC (127.0.0.1:8766); Tailscale Serve lo publica con HTTPS en la
# tailnet (https://<pc>.<tailnet>.ts.net/), que es lo que Safari necesita para instalar la app.
# Lo que imprime queda en <carpeta de datos>\registros.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$datos = if ($env:LIBRO_GASTOS_DATOS) { $env:LIBRO_GASTOS_DATOS } else { Join-Path $HOME 'LibroDeGastos\datos' }
$registros = Join-Path $datos 'registros'
New-Item -ItemType Directory -Force $registros | Out-Null
$puerto = 8766

function Anotar([string]$texto) {
    Add-Content -Path (Join-Path $registros 'inicio.log') -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $texto" -Encoding utf8
}

if (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue) {
    Anotar 'El servidor ya estaba corriendo'
} else {
    $env:PYTHONUNBUFFERED = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    Start-Process -FilePath (Get-Command uv).Source -ArgumentList 'run', 'python', '-m', 'servidor', '--puerto', $puerto `
        -WorkingDirectory (Join-Path $raiz 'backend\servidor') -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $registros 'servidor.log') -RedirectStandardError (Join-Path $registros 'servidor-errores.log')
    Anotar 'Servidor arrancado'
}

# Tailscale Serve guarda su configuración, así que esto solo hace falta la primera vez; repetirlo no
# cambia nada. Si los certificados HTTPS de la tailnet no están activados, queda anotado en el log.
# Sin Serve activado en la tailnet, `tailscale serve` imprime el enlace para activarlo y se queda
# esperando: por eso corre aparte y se corta a los 15 segundos.
$tailscale = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
if (Test-Path $tailscale) {
    $tarea = Start-Job { param($exe, $p) & $exe serve --bg $p 2>&1 } -ArgumentList $tailscale, $puerto
    $termino = Wait-Job $tarea -Timeout 15
    $salida = (Receive-Job $tarea | Out-String).Trim() -replace '\s+', ' '
    Remove-Job $tarea -Force
    Anotar "Tailscale Serve: $(if ($termino) { $salida } else { "sin activar en la tailnet. $salida" })"
}
