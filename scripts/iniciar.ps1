# Arranca en segundo plano, sin ventanas, lo que el Libro de Gastos necesita en la PC:
#   - el servidor (puerto 8766), que guarda los datos;
#   - Metro (puerto 8082), que le pasa el código a la app de desarrollo del iPhone;
#   - la app web (app\dist, la sirve el servidor en /app): se compila si falta o si el código cambió.
# Pensado para correr solo al iniciar sesión (ver instalar-inicio.ps1). Lo que ya está corriendo
# no se toca. Lo que imprimen queda en <carpeta de datos>\registros.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$datos = if ($env:LIBRO_GASTOS_DATOS) { $env:LIBRO_GASTOS_DATOS } else { Join-Path $raiz 'datos' }
$registros = Join-Path $datos 'registros'
New-Item -ItemType Directory -Force $registros | Out-Null

function Escuchando([int]$puerto) {
    [bool](Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue)
}

function Anotar([string]$texto) {
    Add-Content -Path (Join-Path $registros 'inicio.log') -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $texto" -Encoding utf8
}

# --- Servidor ------------------------------------------------------------------------------
if (Escuchando 8766) {
    Anotar 'El servidor ya estaba corriendo'
} else {
    $env:PYTHONUNBUFFERED = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    Start-Process -FilePath (Get-Command uv).Source -ArgumentList 'run', 'python', '-m', 'gastos' `
        -WorkingDirectory (Join-Path $raiz 'servidor') -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $registros 'servidor.log') -RedirectStandardError (Join-Path $registros 'servidor-errores.log')
    Anotar 'Servidor arrancado'
}

# --- Metro (solo mientras la app del iPhone sea un build de desarrollo) ---------------------
# Anuncia la IP de Tailscale de la PC, que el teléfono alcanza en casa y afuera.
$app = Join-Path $raiz 'app'
if (-not (Test-Path (Join-Path $app 'node_modules'))) {
    Anotar 'Metro no arranca: falta npm install en app\'
} elseif (Escuchando 8082) {
    Anotar 'Metro ya estaba corriendo'
} else {
    $tailscale = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    # Si Tailscale está caído, `tailscale ip` falla: Metro arranca igual con la IP de la red local.
    if (Test-Path $tailscale) {
        try {
            $ip = (& $tailscale ip -4 2>$null | Select-Object -First 1)
            if ($ip -match '^100\.') { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip.Trim() }
        } catch {
            Anotar "Tailscale no respondió: $($_.Exception.Message)"
        }
    }
    Start-Process -FilePath (Get-Command npx.cmd).Source -ArgumentList 'expo', 'start', '--lan', '--dev-client', '--port', '8082' `
        -WorkingDirectory $app -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $registros 'metro.log') -RedirectStandardError (Join-Path $registros 'metro-errores.log')
    Anotar "Metro arrancado en $($env:REACT_NATIVE_PACKAGER_HOSTNAME):8082"
}

# --- La app web (iPad o cualquier navegador de la tailnet) ---------------------------------
# El servidor la sirve en /app desde app\dist. Si falta o el código es más nuevo, se vuelve a compilar.
if (Test-Path (Join-Path $app 'node_modules')) {
    $indice = Join-Path $app 'dist\index.html'
    $fuentes = @(Get-ChildItem (Join-Path $app 'src'), (Join-Path $app 'public') -Recurse -File) + @(Get-Item (Join-Path $app 'app.json'))
    $ultimo = ($fuentes | Measure-Object -Property LastWriteTime -Maximum).Maximum
    if (-not (Test-Path $indice) -or $ultimo -gt (Get-Item $indice).LastWriteTime) {
        Start-Process -FilePath (Get-Command npx.cmd).Source -ArgumentList 'expo', 'export', '--platform', 'web' `
            -WorkingDirectory $app -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $registros 'web.log') -RedirectStandardError (Join-Path $registros 'web-errores.log')
        Anotar 'Compilando la app web'
    }
}
