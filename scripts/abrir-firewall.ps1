# Deja entrar al servidor (8766) y a Metro (8082) solo desde redes Privadas, que en esta PC es la
# de Tailscale. Hace falta una sola vez y pide permisos de administrador.
#   powershell -ExecutionPolicy Bypass -File scripts/abrir-firewall.ps1

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

foreach ($regla in @(@{ Nombre = 'Libro de Gastos (servidor)'; Puerto = 8766 }, @{ Nombre = 'Libro de Gastos (Metro)'; Puerto = 8082 })) {
    Get-NetFirewallRule -DisplayName $regla.Nombre -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $regla.Nombre -Direction Inbound -Action Allow -Protocol TCP `
        -LocalPort $regla.Puerto -Profile Private | Out-Null
    Write-Output "Listo: $($regla.Nombre), puerto $($regla.Puerto), solo redes privadas"
}
Start-Sleep 3
